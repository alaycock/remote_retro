# Deploying to GCP (Cloud Run + Cloud SQL)

Production runs as a single always-on Cloud Run instance (live retros use in-memory
presence/PubSub, so it must stay at one instance) backed by Cloud SQL Postgres 17.
Gemini uses the service's own service account — no key files.

| Resource | Name |
|---|---|
| Project / region | `hb-remote-retro` / `us-central1` |
| Cloud Run service | `remote-retro` (min = max = 1, session affinity, 60 min request timeout) |
| Cloud SQL | `remote-retro-db`, Postgres 17, `db-f1-micro`, daily backups |
| Service account | `remote-retro-run@…` — Cloud SQL Client, Vertex AI User, access to its secrets |
| Secrets (Secret Manager) | `remote-retro-database-url`, `remote-retro-secret-key-base`, `remote-retro-oauth-client-secret` |
| Images | Artifact Registry `us-central1-docker.pkg.dev/hb-remote-retro/remote-retro/app` |

Rough cost: ~$10/mo Cloud SQL + ~$10–15/mo for the always-on instance.

## Deploy

gcloud runs in a container (`deploy/run.sh`), using its own config dir
`~/.config/gcloud-remote-retro`.

1. Sign in once (interactive — run it in a terminal):

       deploy/run.sh gcloud auth login --no-launch-browser

2. Provision + deploy (safe to re-run; it creates what's missing and ships a new image):

       deploy/run.sh ./deploy/deploy.sh

3. First deploy only: add the printed redirect URI
   (`https://remote-retro-<project-number>.us-central1.run.app/auth/google/callback`) to the
   OAuth client's **Authorized redirect URIs** in the Google Cloud Console
   (*APIs & Services → Credentials*, in whichever project owns the client in `env.sh`).

Migrations run automatically when the container starts.

Override defaults with env vars, e.g. `deploy/run.sh env SQL_TIER=db-g1-small ./deploy/deploy.sh`.

## Email

Without `SENDGRID_API_KEY` the action-item emails are only logged. To send them, store the key
as a secret and add it to the service:

    deploy/run.sh gcloud run services update remote-retro --region us-central1 \
      --update-secrets SENDGRID_API_KEY=<secret-name>:latest \
      --update-env-vars 'MAIL_FROM="Remote Retro" <retro@your-domain>'

## Useful

    deploy/run.sh gcloud run services logs read remote-retro --region us-central1 --limit 100
    deploy/run.sh gcloud sql connect remote-retro-db --user remote_retro   # needs psql in the image
