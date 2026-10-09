# shellcheck shell=bash disable=SC2034
# Shared settings for every deploy script. To move to another project (or org), change
# PROJECT here, or override it per run: `PROJECT=my-new-project deploy/bootstrap.sh`.
# Sourced by the scripts; not meant to be run.
PROJECT="${PROJECT:-hb-remote-retro}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-remote-retro}"
SQL_INSTANCE="${SQL_INSTANCE:-remote-retro-db}"
SQL_TIER="${SQL_TIER:-db-f1-micro}"
GITHUB_REPO="${GITHUB_REPO:-alaycock/remote_retro}"

# Derived names (fixed per project).
DB_NAME="remote_retro"
DB_USER="remote_retro"
STAGING_DB="remote_retro_staging"
REPO="remote-retro"
SA_NAME="remote-retro-run"
DEPLOYER="remote-retro-deployer"
WIF_POOL="github"
WIF_PROVIDER="github-oidc"
CONN="$PROJECT:$REGION:$SQL_INSTANCE"
