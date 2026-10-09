#!/usr/bin/env bash
# Copy the production (and staging) database from the old project's Cloud SQL instance into
# the new one, replacing what's there. Run after deploy/bootstrap.sh, ideally while nobody is
# in a retro (anything written to the old app after the copy stays behind).
#
#   FROM_PROJECT=hb-remote-retro PROJECT=new-project-id deploy/migrate-data.sh
#   SKIP_STAGING=1 …   # production only
#   YES=1 …            # don't ask for confirmation
#
# Needs Docker, the deploy/run.sh gcloud sign-in, and application-default credentials in
# ~/.config/gcloud-remote-retro (used by the Cloud SQL proxies) for an account with Cloud SQL
# Client + Secret Manager access on BOTH projects. Instance names/region come from config.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=deploy/config.sh
source deploy/config.sh
: "${FROM_PROJECT:?set FROM_PROJECT to the old project id}"
[ "$FROM_PROJECT" != "$PROJECT" ] || { echo "FROM_PROJECT and PROJECT are the same ($PROJECT)" >&2; exit 1; }
FROM_SQL_INSTANCE="${FROM_SQL_INSTANCE:-$SQL_INSTANCE}"
FROM_REGION="${FROM_REGION:-$REGION}"
NET="rr-migrate"
PROXY_IMAGE="gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.25.4"

secret() { deploy/run.sh gcloud --quiet --project "$1" secrets versions access latest --secret="$2" </dev/null; }
user_of() { sed -E 's#^ecto://([^:]+):.*#\1#' <<<"$1"; }
pass_of() { sed -E 's#^ecto://[^:]+:([^@]+)@.*#\1#' <<<"$1"; }
db_of() { sed -E 's#.*/([^/?]+)$#\1#' <<<"$1"; }

echo "==> Reading credentials from Secret Manager"
old_url=$(secret "$FROM_PROJECT" remote-retro-database-url)
new_url=$(secret "$PROJECT" remote-retro-database-url)
if [ -z "${SKIP_STAGING:-}" ]; then
  old_staging=$(secret "$FROM_PROJECT" remote-retro-staging-db-password 2>/dev/null || true)
  new_staging=$(secret "$PROJECT" remote-retro-staging-db-password 2>/dev/null || true)
  if [ -z "$old_staging" ] || [ -z "$new_staging" ]; then
    echo "    staging isn't set up on both projects; copying production only"
    SKIP_STAGING=1
  fi
fi

if [ -z "${YES:-}" ]; then
  echo
  echo "This REPLACES the data in $PROJECT ($SQL_INSTANCE) with a copy from $FROM_PROJECT ($FROM_SQL_INSTANCE):"
  echo "  $(db_of "$old_url") → $(db_of "$new_url")"
  [ -z "${SKIP_STAGING:-}" ] && echo "  $STAGING_DB → $STAGING_DB"
  read -r -p "Continue? [y/N] " answer
  [ "$answer" = "y" ] || [ "$answer" = "Y" ] || { echo "Aborted."; exit 1; }
fi

cleanup() {
  docker rm -f rr-migrate-old rr-migrate-new >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup
docker network create "$NET" >/dev/null
for side in old new; do
  if [ $side = old ]; then conn="$FROM_PROJECT:$FROM_REGION:$FROM_SQL_INSTANCE"; else conn="$CONN"; fi
  docker run -d --name "rr-migrate-$side" --network "$NET" \
    -v "$HOME/.config/gcloud-remote-retro:/gcloud:ro" \
    -e GOOGLE_APPLICATION_CREDENTIALS=/gcloud/application_default_credentials.json \
    "$PROXY_IMAGE" --address 0.0.0.0 --port 5432 "$conn" >/dev/null
done
sleep 4

psql_on() { # psql_on HOST USER PASS DB SQL
  docker run --rm --network "$NET" -e PGPASSWORD="$3" postgres:17 psql -h "$1" -U "$2" -d "$4" -tAc "$5"
}

# copy FROM_USER FROM_PASS FROM_DB TO_USER TO_PASS TO_DB
copy() {
  echo "==> Copying $3 → $6"
  # --clean drops the app's tables (including schema_migrations) in the target first, so the
  # result is exactly the source. --no-owner/--no-privileges: the target's own user owns it all.
  docker run --rm --network "$NET" -e PGPASSWORD="$2" postgres:17 \
    pg_dump -h rr-migrate-old -U "$1" -d "$3" --format=custom --no-owner --no-privileges |
    docker run --rm -i --network "$NET" -e PGPASSWORD="$5" postgres:17 \
      pg_restore -h rr-migrate-new -U "$4" -d "$6" --clean --if-exists --no-owner --no-privileges --exit-on-error
  local q="select (select count(*) from retros) || ' retros, ' || (select count(*) from ideas) || ' ideas, ' || (select count(*) from users) || ' users'"
  echo "    source: $(psql_on rr-migrate-old "$1" "$2" "$3" "$q")"
  echo "    target: $(psql_on rr-migrate-new "$4" "$5" "$6" "$q")"
}

copy "$(user_of "$old_url")" "$(pass_of "$old_url")" "$(db_of "$old_url")" \
  "$(user_of "$new_url")" "$(pass_of "$new_url")" "$(db_of "$new_url")"
if [ -z "${SKIP_STAGING:-}" ]; then
  copy "$STAGING_DB" "$old_staging" "$STAGING_DB" "$STAGING_DB" "$new_staging" "$STAGING_DB"
fi

echo "==> Restarting $SERVICE so it reconnects to the restored database"
deploy/run.sh gcloud --quiet --project "$PROJECT" run services update "$SERVICE" --region="$REGION" \
  --update-env-vars="DATA_RESTORED_AT=$(date -u +%Y%m%dT%H%M%SZ)" </dev/null >/dev/null
echo "==> Done"
