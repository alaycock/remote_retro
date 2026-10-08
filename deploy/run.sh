#!/usr/bin/env bash
# Runs gcloud (or deploy.sh) in a throwaway container with the repo-specific gcloud
# config in ~/.config/gcloud-remote-retro. No local gcloud install needed.
#   deploy/run.sh gcloud auth login --no-launch-browser   # once
#   deploy/run.sh ./deploy/deploy.sh                      # provision + deploy
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p "$HOME/.config/gcloud-remote-retro"
tty_flag=""; [ -t 0 ] && tty_flag="-it"
exec docker run --rm $tty_flag \
  -v "$HOME/.config/gcloud-remote-retro:/root/.config/gcloud" \
  -v "$PWD:/workspace" -w /workspace \
  gcr.io/google.com/cloudsdktool/google-cloud-cli:slim "$@"
