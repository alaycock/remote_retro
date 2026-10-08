#!/usr/bin/env bash
# Point the live service at the OAuth client in deploy/env.prod.sh, without a rebuild:
# stores the secret as a new Secret Manager version and rolls a revision with the new
# client id. Run via: deploy/run.sh ./deploy/set-oauth.sh
set -euo pipefail

PROJECT="${PROJECT:-hb-remote-retro}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-remote-retro}"
SECRET="remote-retro-oauth-client-secret"

# shellcheck disable=SC1091
source deploy/env.prod.sh
: "${REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID:?set in deploy/env.prod.sh}"
: "${REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_SECRET:?set in deploy/env.prod.sh}"

gcloud config set project "$PROJECT" --quiet >/dev/null
if [ "$(gcloud secrets versions access latest --secret="$SECRET")" != "$REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_SECRET" ]; then
  printf '%s' "$REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_SECRET" | gcloud secrets versions add "$SECRET" --data-file=- >/dev/null
  echo "Stored a new version of $SECRET"
fi

# A new revision re-resolves the secret's :latest version.
gcloud run services update "$SERVICE" --region="$REGION" --quiet \
  --update-env-vars="REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID=$REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID" \
  --update-secrets="REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_SECRET=$SECRET:latest"
echo "Live service now uses client ${REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID%%-*}-…"
