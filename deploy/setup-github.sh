#!/usr/bin/env bash
# One-time (idempotent): let GitHub Actions in alaycock/remote_retro deploy to Cloud Run
# via Workload Identity Federation — short-lived tokens, no service account keys.
# Run via: deploy/run.sh ./deploy/setup-github.sh
set -euo pipefail

# shellcheck source=deploy/config.sh
source "$(dirname "$0")/config.sh"
POOL="$WIF_POOL"
PROVIDER="$WIF_PROVIDER"
RUNTIME_SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"

gcloud config set project "$PROJECT" --quiet >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
DEPLOYER_SA="$DEPLOYER@$PROJECT.iam.gserviceaccount.com"

echo "==> Deployer service account"
gcloud iam service-accounts describe "$DEPLOYER_SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$DEPLOYER" --display-name="Remote Retro deployer (GitHub Actions)"
# Deploy new revisions of the service…
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$DEPLOYER_SA" \
  --role=roles/run.developer --condition=None >/dev/null
# …that run as the runtime service account…
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --member="serviceAccount:$DEPLOYER_SA" \
  --role=roles/iam.serviceAccountUser >/dev/null
# …from images it pushes to this one repository.
gcloud artifacts repositories add-iam-policy-binding "$REPO" --location="$REGION" \
  --member="serviceAccount:$DEPLOYER_SA" --role=roles/artifactregistry.writer >/dev/null

echo "==> Workload identity pool + GitHub OIDC provider"
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers describe "$PROVIDER" --location=global \
  --workload-identity-pool="$POOL" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --location=global \
    --workload-identity-pool="$POOL" --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '$GITHUB_REPO' && assertion.ref == 'refs/heads/master'"

echo "==> Allow $GITHUB_REPO (master only) to act as the deployer"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$GITHUB_REPO" \
  >/dev/null

echo "==> Done. GitHub repository variables for .github/workflows/deploy.yml"
echo "    (Settings → Secrets and variables → Actions → Variables, or: gh variable set NAME --body VALUE):"
echo "GCP_PROJECT=$PROJECT"
echo "GCP_REGION=$REGION"
echo "GCP_WIF_PROVIDER=projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"
echo "GCP_DEPLOYER_SA=$DEPLOYER_SA"
echo "APP_URL=https://$SERVICE-$PROJECT_NUMBER.$REGION.run.app"
