#!/usr/bin/env bash
# Provision (idempotently) and deploy Remote Retro to Cloud Run + Cloud SQL.
# Runs inside the gcloud container via deploy/run.sh; see deploy/README.md.
set -euo pipefail

# shellcheck source=deploy/config.sh
source "$(dirname "$0")/config.sh"

# Production OAuth client id/secret (and optionally SendGrid) come from deploy/env.prod.sh
# (gitignored, never uploaded) — deliberately not the dev env.sh. See deploy/env.prod.sh.example.
# shellcheck disable=SC1091
[ -f deploy/env.prod.sh ] && source deploy/env.prod.sh
: "${REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID:?set in deploy/env.prod.sh}"
: "${REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_SECRET:?set in deploy/env.prod.sh}"

gcloud config set project "$PROJECT" --quiet >/dev/null
gcloud config set run/region "$REGION" --quiet >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
# OAuth client ids start with the number of the project that owns them; a client from
# another project would sign people in against the wrong consent screen (or fail).
case "$REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID" in
  "$PROJECT_NUMBER"-*) ;;
  *) echo "WARNING: the OAuth client in deploy/env.prod.sh belongs to another project (not $PROJECT_NUMBER)." >&2 ;;
esac
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
HOST="$SERVICE-$PROJECT_NUMBER.$REGION.run.app"
IMAGE="$REGION-docker.pkg.dev/$PROJECT/$REPO/app:$(date +%Y%m%d-%H%M%S)"

step() { printf '\n==> %s\n' "$*"; }

secret() { # secret NAME VALUE  (creates, or adds a version only if the value changed)
  local name=$1 value=$2
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic >/dev/null
  elif [ "$(gcloud secrets versions access latest --secret="$name" 2>/dev/null)" != "$value" ]; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$name" --member="serviceAccount:$SA" \
    --role=roles/secretmanager.secretAccessor --condition=None >/dev/null
}

step "Enabling APIs"
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com aiplatform.googleapis.com iam.googleapis.com

step "Cloud Build service account"
# Newer organizations stop default service accounts from getting broad roles automatically,
# which leaves `gcloud builds submit` unable to push images; grant the build role explicitly.
BUILD_SA=$(gcloud builds get-default-service-account --format='value(serviceAccountEmail)' | sed 's#.*/##')
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$BUILD_SA" \
  --role=roles/cloudbuild.builds.builder --condition=None >/dev/null

step "Service account $SA"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$SA_NAME" --display-name="Remote Retro (Cloud Run)"
for role in roles/cloudsql.client roles/aiplatform.user; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role" \
    --condition=None >/dev/null
done

step "Artifact Registry repo $REPO"
gcloud artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION"

step "Cloud SQL instance $SQL_INSTANCE (first run takes ~10 minutes)"
if ! gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1; then
  gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_17 --edition=ENTERPRISE \
    --tier="$SQL_TIER" --region="$REGION" --storage-size=10 --storage-auto-increase \
    --backup-start-time=08:00
fi
gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" >/dev/null 2>&1 ||
  gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE"

step "Secrets"
if gcloud secrets describe remote-retro-database-url >/dev/null 2>&1; then
  DATABASE_URL=$(gcloud secrets versions access latest --secret=remote-retro-database-url)
else
  DB_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
  if gcloud sql users list --instance="$SQL_INSTANCE" --format='value(name)' | grep -qx "$DB_USER"; then
    gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASSWORD"
  else
    gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASSWORD"
  fi
  # Host is ignored: DB_SOCKET_DIR points Postgrex at the Cloud SQL unix socket.
  DATABASE_URL="ecto://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME"
fi
secret remote-retro-database-url "$DATABASE_URL"
if gcloud secrets describe remote-retro-secret-key-base >/dev/null 2>&1; then
  SECRET_KEY_BASE=$(gcloud secrets versions access latest --secret=remote-retro-secret-key-base)
else
  SECRET_KEY_BASE=$(head -c 64 /dev/urandom | base64 | tr -d '\n')
fi
secret remote-retro-secret-key-base "$SECRET_KEY_BASE"
secret remote-retro-oauth-client-secret "$REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_SECRET"

# Optional: action-item emails. Without a key they're only logged.
ENV_VARS="PHX_HOST=$HOST,DB_SOCKET_DIR=/cloudsql/$CONN,POOL_SIZE=5,GCP_PROJECT=$PROJECT,GCP_LOCATION=global,REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID=$REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID,REMOTE_RETRO_GOOGLE_OAUTH_REDIRECT_URI=https://$HOST/auth/google/callback"
SECRETS="DATABASE_URL=remote-retro-database-url:latest,SECRET_KEY_BASE=remote-retro-secret-key-base:latest,REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_SECRET=remote-retro-oauth-client-secret:latest"
if [ -n "${SENDGRID_API_KEY:-}" ]; then
  secret remote-retro-sendgrid-api-key "$SENDGRID_API_KEY"
  SECRETS="$SECRETS,SENDGRID_API_KEY=remote-retro-sendgrid-api-key:latest"
fi
# MAIL_FROM contains commas/quotes in its display-name form, so it's passed on its own below.

step "Building $IMAGE on Cloud Build"
gcloud builds submit --tag "$IMAGE" .

step "Deploying Cloud Run service $SERVICE"
gcloud run deploy "$SERVICE" --image="$IMAGE" --service-account="$SA" \
  --add-cloudsql-instances="$CONN" \
  --min-instances=1 --max-instances=1 --session-affinity --timeout=3600 \
  --cpu=1 --memory=512Mi --allow-unauthenticated \
  --set-env-vars="$ENV_VARS" --set-secrets="$SECRETS"
if [ -n "${MAIL_FROM:-}" ]; then
  # `^|^` switches gcloud's list delimiter so commas in the value survive.
  gcloud run services update "$SERVICE" --quiet --update-env-vars="^|^MAIL_FROM=$MAIL_FROM"
fi

step "Done"
echo "URL:          https://$HOST"
echo "OAuth redirect URI to allow on the OAuth client: https://$HOST/auth/google/callback"
