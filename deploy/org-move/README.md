# One-off: moving to a new project or organization

A one-time runbook for moving Remote Retro's GCP setup (see [`../README.md`](../README.md)) into
another project, e.g. under a new organization. The two scripts here exist only for this move.

Two options:

- **Move the existing project** into the new org (`gcloud beta projects move <project>
  --organization=<org-id>`; needs project-creator rights in the target org). Keeps everything
  (project number, URL, OAuth client, data, GitHub trust), so nothing below is needed. Check the
  target org's policies first (the ones `bootstrap.sh` warns about).
- **Recreate it** in a new project with the scripts below. The app URL changes (it contains the
  project number), sessions are signed out (new `SECRET_KEY_BASE`), and the database passwords
  are new.

## Recreate

1. Sign in with an account that can create projects in the new org and read the old project.
   Both logins are needed (the second is for the Cloud SQL proxies):

       deploy/run.sh gcloud auth login --no-launch-browser
       deploy/run.sh gcloud auth application-default login --no-launch-browser

2. Create the project and everything in it. Resumable; re-run until it prints "All set":

       PROJECT=<new-id> ORG_ID=<org-id> BILLING_ACCOUNT=<billing-id> deploy/org-move/bootstrap.sh

   It creates the project, links billing, warns about org policies that would break the app
   (domain restricted sharing blocks the public `allUsers` invoker; `sql.restrictPublicIp`;
   Workload Identity provider and location restrictions), then **stops once** for the one manual
   step: creating the production OAuth client in the Console. It prints the exact origin and
   redirect URI to use. The Audience setting **Internal** limits sign-in to people in the
   organization. After that it runs `deploy.sh`, `setup-github.sh` (and sets the GitHub
   variables), `setup-staging.sh`, and points local dev's Vertex AI at the new project.
   `CHECK=1 deploy/org-move/bootstrap.sh` reports what exists without changing anything.

3. Copy the data (production and staging), ideally while nobody is in a retro:

       FROM_PROJECT=<old-id> PROJECT=<new-id> deploy/org-move/migrate-data.sh

   It replaces the new databases with `pg_dump`/`pg_restore` copies, prints row counts on both
   sides, and restarts the service.

4. Set `PROJECT` in [`../config.sh`](../config.sh) to the new id and commit, so later runs default to it. Recreate
   the dev containers (`cd docker-dev && docker compose up -d --force-recreate app staging-db`)
   and push to `master` to check the GitHub deploy.

5. Not moved automatically: the **dev OAuth client** in `env.sh` (if it lives in the old project,
   create a Web client in the new one with redirect `http://localhost:4000/auth/google/callback`)
   and anything you've added by hand outside these scripts. Shut the old project down once the new
   one is working.

Once the move is done, this directory can be deleted.
