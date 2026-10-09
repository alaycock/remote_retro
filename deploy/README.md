# Deploying to GCP (Cloud Run + Cloud SQL)

Production runs as a single always-on Cloud Run instance (live retros use in-memory
presence/PubSub, so it must stay at one instance) backed by Cloud SQL Postgres 17.
Gemini uses the service's own service account — no key files.

| Resource | Name |
|---|---|
| Project / region | `PROJECT` / `REGION` from [`config.sh`](config.sh) (currently `hb-remote-retro` / `us-central1`) |
| Cloud Run service | `remote-retro` (min = max = 1, session affinity, 60 min request timeout) |
| Cloud SQL | `remote-retro-db`, Postgres 17, `db-f1-micro`, daily backups |
| Service account | `remote-retro-run@…` — Cloud SQL Client, Vertex AI User, access to its secrets |
| Secrets (Secret Manager) | `remote-retro-database-url`, `remote-retro-secret-key-base`, `remote-retro-oauth-client-secret`, `remote-retro-staging-db-password` (+ `remote-retro-sendgrid-api-key` if email is on) |
| Images | Artifact Registry `<region>-docker.pkg.dev/<project>/remote-retro/app` |
| GitHub deploys | Workload Identity pool `github` / provider `github-oidc`, deployer SA `remote-retro-deployer@…` |

Every script reads its names from [`config.sh`](config.sh); override per run with env vars
(`PROJECT=other deploy/bootstrap.sh`, or `deploy/run.sh env PROJECT=other ./deploy/deploy.sh`).

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
   production OAuth client's **Authorized redirect URIs** in the Google Cloud Console
   (*APIs & Services → Credentials*).

Migrations run automatically when the container starts.

## Production OAuth client

Prod uses its own OAuth client, kept in `deploy/env.prod.sh` (gitignored; copy
`deploy/env.prod.sh.example`). `deploy.sh` reads it — never the dev `env.sh`. To switch the
live service to a new client without a rebuild:

    cp deploy/env.prod.sh.example deploy/env.prod.sh   # then fill in the id + secret
    deploy/run.sh ./deploy/set-oauth.sh

This stores the secret as a new Secret Manager version and rolls a revision with the new id.

Override defaults with env vars, e.g. `deploy/run.sh env SQL_TIER=db-g1-small ./deploy/deploy.sh`.

## Email

Without `SENDGRID_API_KEY` the action-item emails are only logged (the case today). To send
them, add `SENDGRID_API_KEY` and `MAIL_FROM` to `deploy/env.prod.sh` and re-run `deploy.sh`: it
stores the key in Secret Manager and wires both into the service.

## Useful

    deploy/run.sh gcloud run services logs read remote-retro --region us-central1 --limit 100
    deploy/run.sh gcloud sql connect remote-retro-db --user remote_retro   # needs psql in the image

## Continuous deployment (GitHub Actions)

`.github/workflows/deploy.yml` runs on every push to `master`: backend + frontend tests, then
(only if they pass) builds the image on the runner, pushes it to Artifact Registry and rolls a
new Cloud Run revision. Only the image changes; env vars, secrets and scaling set by
`deploy.sh` carry over.

GitHub authenticates with **Workload Identity Federation** — no keys stored in GitHub. The
trust is limited to `alaycock/remote_retro` on `refs/heads/master`, and the deployer service
account can only deploy revisions, act as the runtime service account, and push to the one
image repository. One-time setup (after the first `deploy.sh`):

    deploy/run.sh ./deploy/setup-github.sh

Where the workflow deploys comes from **repository variables** (Settings → Secrets and variables →
Actions → Variables): `GCP_PROJECT`, `GCP_REGION`, `GCP_WIF_PROVIDER`, `GCP_DEPLOYER_SA`,
`APP_URL`. `setup-github.sh` prints them; `bootstrap.sh` sets them with `gh`. The deploy job
fails fast if one is missing.

Re-run `deploy.sh` locally when infrastructure or config changes (scaling, env vars, secrets).

## Staging database (local dev)

`remote_retro_staging` lives on the same Cloud SQL instance, owned by its own
`remote_retro_staging` role, which can't connect to the production database (and other roles
can't connect to staging). Local dev reaches it through the `staging-db` proxy in docker-dev.
One-time setup from the repo root (needs the `deploy/run.sh` gcloud sign-in and the
`~/.config/gcloud-remote-retro` ADC):

    deploy/setup-staging.sh

It stores the role's password in Secret Manager (`remote-retro-staging-db-password`) and
writes `DEV_DATABASE_URL` into the gitignored `env.sh`. Then recreate the dev container and
migrate staging:

    cd docker-dev && docker compose up -d --force-recreate app staging-db
    docker compose exec app mix ecto.migrate

## Moving to a new project or organization

Two options:

- **Move the existing project** into the new org (`gcloud beta projects move <project>
  --organization=<org-id>`; needs project-creator rights in the target org). Keeps everything
  (project number, URL, OAuth client, data, GitHub trust), so nothing below is needed. Check the
  target org's policies first (the ones `bootstrap.sh` warns about).
- **Recreate it** in a new project with the scripts below. The app URL changes (it contains the
  project number), sessions are signed out (new `SECRET_KEY_BASE`), and the database passwords
  are new.

### Recreate

1. Sign in with an account that can create projects in the new org and read the old project.
   Both logins are needed (the second is for the Cloud SQL proxies):

       deploy/run.sh gcloud auth login --no-launch-browser
       deploy/run.sh gcloud auth application-default login --no-launch-browser

2. Create the project and everything in it. Resumable; re-run until it prints "All set":

       PROJECT=<new-id> ORG_ID=<org-id> BILLING_ACCOUNT=<billing-id> deploy/bootstrap.sh

   It creates the project, links billing, warns about org policies that would break the app
   (domain restricted sharing blocks the public `allUsers` invoker; `sql.restrictPublicIp`;
   Workload Identity provider and location restrictions), then **stops once** for the one manual
   step: creating the production OAuth client in the Console. It prints the exact origin and
   redirect URI to use. The Audience setting **Internal** limits sign-in to people in the
   organization. After that it runs `deploy.sh`, `setup-github.sh` (and sets the GitHub
   variables), `setup-staging.sh`, and points local dev's Vertex AI at the new project.
   `CHECK=1 deploy/bootstrap.sh` reports what exists without changing anything.

3. Copy the data (production and staging), ideally while nobody is in a retro:

       FROM_PROJECT=<old-id> PROJECT=<new-id> deploy/migrate-data.sh

   It replaces the new databases with `pg_dump`/`pg_restore` copies, prints row counts on both
   sides, and restarts the service.

4. Set `PROJECT` in `config.sh` to the new id and commit, so later runs default to it. Recreate
   the dev containers (`cd docker-dev && docker compose up -d --force-recreate app staging-db`)
   and push to `master` to check the GitHub deploy.

5. Not moved automatically: the **dev OAuth client** in `env.sh` (if it lives in the old project,
   create a Web client in the new one with redirect `http://localhost:4000/auth/google/callback`)
   and anything you've added by hand outside these scripts. Shut the old project down once the new
   one is working.
