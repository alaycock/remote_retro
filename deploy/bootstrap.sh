#!/usr/bin/env bash
# Recreate Remote Retro's whole GCP setup in a new project, e.g. when moving to another
# organization. Resumable: re-run it until it prints "All set"; every step skips what exists.
#
#   PROJECT=new-project-id ORG_ID=123456789 BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX deploy/bootstrap.sh
#     (FOLDER_ID=… instead of ORG_ID to create the project in a folder; both are only
#      needed if the project doesn't exist yet. BILLING_ACCOUNT only if billing isn't linked.)
#   CHECK=1 deploy/bootstrap.sh     # read-only: report what exists, change nothing
#
# Then copy the data across with deploy/migrate-data.sh, and set PROJECT in deploy/config.sh.
# Run from the host (needs Docker; gh for the GitHub step). gcloud runs via deploy/run.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=deploy/config.sh
source deploy/config.sh

CHECK="${CHECK:-}"
step() { printf '\n==> %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
warn() { printf '    WARNING: %s\n' "$*" >&2; }
gc() { deploy/run.sh gcloud --quiet "$@" </dev/null; }
# The deploy scripts run inside the gcloud container, which doesn't inherit our env.
in_container() {
  deploy/run.sh env PROJECT="$PROJECT" REGION="$REGION" SERVICE="$SERVICE" SQL_INSTANCE="$SQL_INSTANCE" \
    SQL_TIER="$SQL_TIER" GITHUB_REPO="$GITHUB_REPO" "$@" </dev/null
}

step "gcloud sign-in"
ACCOUNT=$(gc auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)
if [ -z "$ACCOUNT" ]; then
  note "Not signed in. Run this in a terminal, then re-run bootstrap:"
  note "  deploy/run.sh gcloud auth login --no-launch-browser"
  note "  deploy/run.sh gcloud auth application-default login --no-launch-browser   # for the DB proxy + dev Vertex"
  exit 1
fi
note "as $ACCOUNT"

step "Project $PROJECT"
if gc projects describe "$PROJECT" >/dev/null 2>&1; then
  note "exists"
elif [ -n "$CHECK" ]; then
  note "MISSING (would be created under ${ORG_ID:+organization $ORG_ID}${FOLDER_ID:+folder $FOLDER_ID})"; exit 0
elif [ -n "${ORG_ID:-}${FOLDER_ID:-}" ]; then
  gc projects create "$PROJECT" --name="Remote Retro" \
    ${ORG_ID:+--organization="$ORG_ID"} ${FOLDER_ID:+--folder="$FOLDER_ID"}
else
  note "Doesn't exist. Set ORG_ID (or FOLDER_ID) to create it."; exit 1
fi
PROJECT_NUMBER=$(gc projects describe "$PROJECT" --format='value(projectNumber)')
HOST="$SERVICE-$PROJECT_NUMBER.$REGION.run.app"
note "number $PROJECT_NUMBER → app URL https://$HOST"

step "Billing"
if [ "$(gc billing projects describe "$PROJECT" --format='value(billingEnabled)')" = "True" ]; then
  note "enabled"
elif [ -n "$CHECK" ]; then
  note "NOT LINKED"
elif [ -n "${BILLING_ACCOUNT:-}" ]; then
  gc billing projects link "$PROJECT" --billing-account="$BILLING_ACCOUNT"
else
  note "Not linked. Set BILLING_ACCOUNT (list them: deploy/run.sh gcloud billing accounts list)."; exit 1
fi

step "Organization policies that commonly break this setup (warnings only)"
[ -z "$CHECK" ] && gc services enable orgpolicy.googleapis.com --project="$PROJECT" >/dev/null 2>&1 || true
policy() { gc org-policies describe "$1" --project="$PROJECT" --effective --format=json 2>/dev/null || true; }
p=$(policy iam.allowedPolicyMemberDomains)
if grep -q '"allowedValues"\|"denyAll": true' <<<"$p"; then
  warn "iam.allowedPolicyMemberDomains (domain restricted sharing) is on: Cloud Run can't grant"
  warn "allUsers the invoker role, so the app won't be publicly reachable. Ask an org admin for a"
  warn "project-level exception (or use the newer iam.managed.allowedPolicyMembers with allUsers allowed)."
fi
grep -q '"enforce": true' <<<"$(policy sql.restrictPublicIp)" &&
  warn "sql.restrictPublicIp is enforced: the Cloud SQL instance needs a public IP (used via the connector/proxy). Needs an exception."
grep -q '"allowedValues"\|"denyAll": true' <<<"$(policy iam.workloadIdentityPoolProviders)" &&
  warn "iam.workloadIdentityPoolProviders is restricted: allow https://token.actions.githubusercontent.com for GitHub deploys."
grep -q '"allowedValues"\|"denyAll": true' <<<"$(policy gcp.resourceLocations)" &&
  warn "gcp.resourceLocations is restricted: make sure $REGION is allowed."
note "checked"

step "Production OAuth client (manual: the Console is the only way to create one)"
# shellcheck disable=SC1091
[ -f deploy/env.prod.sh ] && source deploy/env.prod.sh
case "${REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID:-}" in
  "$PROJECT_NUMBER"-*) note "deploy/env.prod.sh has a client from this project" ;;
  *)
    note "deploy/env.prod.sh needs a client created in $PROJECT. In the Cloud Console for $PROJECT:"
    note "  1. Google Auth Platform → Branding: app name, support email. Audience: Internal = only"
    note "     people in the organization can sign in; External + In production = any Google account."
    note "  2. Clients → Create client → Web application:"
    note "       Authorized JavaScript origin:  https://$HOST"
    note "       Authorized redirect URI:       https://$HOST/auth/google/callback"
    note "  3. Put its id + secret in deploy/env.prod.sh (copy deploy/env.prod.sh.example), then re-run."
    [ -n "$CHECK" ] || exit 1 ;;
esac

if [ -n "$CHECK" ]; then
  step "Infrastructure"
  gc run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='value(status.url)' 2>/dev/null |
    sed 's/^/    Cloud Run: /' || note "Cloud Run service: missing"
  gc sql instances describe "$SQL_INSTANCE" --project="$PROJECT" --format='value(state)' 2>/dev/null |
    sed 's/^/    Cloud SQL: /' || note "Cloud SQL instance: missing"
  gc iam workload-identity-pools describe "$WIF_POOL" --project="$PROJECT" --location=global --format='value(state)' 2>/dev/null |
    sed 's/^/    GitHub identity pool: /' || note "GitHub identity pool: missing"
  echo; echo "Check only; nothing changed."; exit 0
fi

step "Provision + deploy (deploy/deploy.sh; first run ~15 minutes for Cloud SQL)"
in_container ./deploy/deploy.sh
if ! gc run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json | grep -q allUsers; then
  warn "The service isn't public (no allUsers invoker), probably the domain restricted sharing policy above."
fi

step "GitHub Actions deploys (Workload Identity Federation + repository variables)"
vars=$(in_container ./deploy/setup-github.sh | tee /dev/stderr | grep -E '^(GCP_[A-Z_]+|APP_URL)=')
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  while IFS='=' read -r key value; do
    gh variable set "$key" --repo "$GITHUB_REPO" --body "$value" && note "set $key"
  done <<<"$vars"
else
  warn "gh isn't signed in; set these as repository variables on $GITHUB_REPO by hand:"
  sed 's/^/      /' <<<"$vars"
fi

step "Staging database for local dev (deploy/setup-staging.sh)"
if [ -f "$HOME/.config/gcloud-remote-retro/application_default_credentials.json" ]; then
  PROJECT="$PROJECT" deploy/setup-staging.sh
else
  warn "No application-default credentials; run: deploy/run.sh gcloud auth application-default login --no-launch-browser"
  warn "then: PROJECT=$PROJECT deploy/setup-staging.sh"
fi

step "Local dev Vertex AI (env.sh GCP_PROJECT + ADC quota project)"
if [ -f env.sh ] && grep -q '^export GCP_PROJECT=' env.sh; then
  sed -i.bak "s#^export GCP_PROJECT=.*#export GCP_PROJECT=$PROJECT#" env.sh && rm -f env.sh.bak
  note "env.sh: GCP_PROJECT=$PROJECT"
fi
gc auth application-default set-quota-project "$PROJECT" >/dev/null 2>&1 && note "ADC quota project → $PROJECT" ||
  warn "couldn't set the ADC quota project (sign in with application-default login first)"
# shellcheck disable=SC1091
dev_client=$(. ./env.sh 2>/dev/null; echo "${REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID:-}")
case "$dev_client" in
  "" | "$PROJECT_NUMBER"-*) ;;
  *) note "env.sh's dev OAuth client is from another project. It keeps working until that project is deleted;"
     note "to move it, create a Web client in $PROJECT with redirect http://localhost:4000/auth/google/callback." ;;
esac

step "All set"
note "App:  https://$HOST"
note "Next:"
note "  1. Copy the data:   FROM_PROJECT=<old-project> PROJECT=$PROJECT deploy/migrate-data.sh"
note "  2. Make it the default: set PROJECT=\"\${PROJECT:-$PROJECT}\" in deploy/config.sh and commit"
note "     (docker-dev: cd docker-dev && docker compose up -d --force-recreate app staging-db)"
note "  3. Push to master to check the GitHub deploy, then shut down the old project when you're happy"
