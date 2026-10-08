# Throwaway containerized dev setup

Everything (Postgres 17, Elixir 1.20 / OTP 28, Node 24) runs in OrbStack.
deps/, _build/, assets/node_modules/ and the DB live in Docker volumes, not on the host.

    cd docker-dev
    docker compose up -d                 # runs `mix setup` then the app at http://localhost:4000
    docker compose logs -f app
    docker compose run --rm app mix test
    docker compose run --rm app bash -c "cd assets && npm test && npm run typecheck"
    docker compose exec app bash         # shell inside running app

Sign in: Google OAuth via ../env.sh (gitignored `export REMOTE_RETRO_GOOGLE_OAUTH_*=...` lines,
loaded automatically). In dev you can skip Google: http://localhost:4000/dev/login?email=you@example.com

Email: closing a retro emails its action items. In dev nothing leaves the machine; open the
mailbox preview at http://localhost:4000/dev/mailbox to read them.

Gemini (optional): credentials live in `~/.config/gcloud-remote-retro` (mounted read-only),
kept apart from any other gcloud identity. No local gcloud needed — run it in a container:

    docker run --rm -it -v ~/.config/gcloud-remote-retro:/root/.config/gcloud \
      gcr.io/google.com/cloudsdktool/google-cloud-cli:slim \
      gcloud auth application-default login --no-launch-browser
    docker run --rm -v ~/.config/gcloud-remote-retro:/root/.config/gcloud \
      gcr.io/google.com/cloudsdktool/google-cloud-cli:slim \
      gcloud auth application-default set-quota-project <PROJECT_ID>

Sign in with an account that has Vertex AI User on the project (Vertex AI API enabled), then add
`export GCP_PROJECT=<PROJECT_ID>` (optionally GCP_LOCATION, GEMINI_MODEL) to ../env.sh and
`docker compose up -d --force-recreate app`.

Teardown (removes containers, volumes, image):

    docker compose down -v --rmi local
