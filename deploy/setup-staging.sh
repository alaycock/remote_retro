#!/usr/bin/env bash
# One-time (idempotent): create the shared `remote_retro_staging` database on the Cloud SQL
# instance, with its own role that cannot connect to production, and point local dev at it
# by writing DEV_DATABASE_URL into the gitignored env.sh.
#
# Run from the repo root on the host: deploy/setup-staging.sh
# Needs: Docker, and gcloud signed in via deploy/run.sh (an account with access to the
# project); ~/.config/gcloud-remote-retro ADC for the Cloud SQL proxy.
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck source=deploy/config.sh
source deploy/config.sh
DB="$STAGING_DB"
ROLE="$STAGING_DB"
SECRET="remote-retro-staging-db-password"
NET="rr-staging-setup"
PROXY_IMAGE="gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.25.4"

gcloud() { deploy/run.sh gcloud --project "$PROJECT" "$@"; }

# Admin connection: the production app user (a cloudsqlsuperuser member, so it may create
# roles and databases). Its URL is ecto://user:pass@host/db.
admin_url=$(gcloud secrets versions access latest --secret=remote-retro-database-url)
admin_user=$(sed -E 's#^ecto://([^:]+):.*#\1#' <<<"$admin_url")
admin_pass=$(sed -E 's#^ecto://[^:]+:([^@]+)@.*#\1#' <<<"$admin_url")
prod_db=$(sed -E 's#.*/([^/?]+)$#\1#' <<<"$admin_url")

if gcloud secrets describe "$SECRET" >/dev/null 2>&1; then
  staging_pass=$(gcloud secrets versions access latest --secret="$SECRET")
else
  staging_pass=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
  printf '%s' "$staging_pass" | gcloud secrets create "$SECRET" --data-file=- --replication-policy=automatic >/dev/null
fi

cleanup() { docker rm -f rr-staging-proxy >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker network create "$NET" >/dev/null
docker run -d --name rr-staging-proxy --network "$NET" \
  -v "$HOME/.config/gcloud-remote-retro:/gcloud:ro" \
  -e GOOGLE_APPLICATION_CREDENTIALS=/gcloud/application_default_credentials.json \
  "$PROXY_IMAGE" --address 0.0.0.0 --port 5432 "$CONN" >/dev/null
sleep 3

echo "==> Creating role + database (idempotent) and locking production to its own user"
docker run --rm -i --network "$NET" -e PGPASSWORD="$admin_pass" postgres:17 \
  psql -v ON_ERROR_STOP=1 -h rr-staging-proxy -U "$admin_user" -d "$prod_db" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$ROLE') THEN
    CREATE ROLE $ROLE LOGIN PASSWORD '$staging_pass';
  ELSE
    ALTER ROLE $ROLE WITH LOGIN PASSWORD '$staging_pass';
  END IF;
END
\$\$;
GRANT $ROLE TO $admin_user;
SELECT 'CREATE DATABASE $DB OWNER $ROLE'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB') \gexec
-- Staging can't reach production, and nobody else can reach staging.
REVOKE CONNECT ON DATABASE $prod_db FROM PUBLIC;
GRANT CONNECT ON DATABASE $prod_db TO $admin_user;
REVOKE CONNECT ON DATABASE $DB FROM PUBLIC;
GRANT CONNECT ON DATABASE $DB TO $ROLE;
SQL

echo "==> Checking the staging role can use staging but not production"
docker run --rm --network "$NET" -e PGPASSWORD="$staging_pass" postgres:17 \
  psql -h rr-staging-proxy -U "$ROLE" -d "$DB" -tAc "select 'staging ok'"
if docker run --rm --network "$NET" -e PGPASSWORD="$staging_pass" postgres:17 \
  psql -h rr-staging-proxy -U "$ROLE" -d "$prod_db" -tAc "select 1" >/dev/null 2>&1; then
  echo "ERROR: staging role can connect to production" >&2
  exit 1
fi
echo "production denied for $ROLE ✓"

url="ecto://$ROLE:$staging_pass@staging-db/$DB"
touch env.sh
if grep -q '^export DEV_DATABASE_URL=' env.sh; then
  sed -i.bak "s#^export DEV_DATABASE_URL=.*#export DEV_DATABASE_URL=$url#" env.sh && rm -f env.sh.bak
else
  printf '\n# Local dev uses the shared staging database (deploy/setup-staging.sh)\nexport DEV_DATABASE_URL=%s\n' "$url" >> env.sh
fi
# docker-dev's staging-db proxy reads the instance from docker-dev/.env (gitignored).
printf 'STAGING_DB_INSTANCE=%s\n' "$CONN" > docker-dev/.env
echo "==> Done. Wrote DEV_DATABASE_URL to env.sh and STAGING_DB_INSTANCE to docker-dev/.env."
echo "    Next: cd docker-dev && docker compose up -d --force-recreate app staging-db && docker compose exec app mix ecto.migrate"
