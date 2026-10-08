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

Gemini (optional): `gcloud auth application-default login` on the host (mounted read-only),
then add `export GCP_PROJECT=...` (and optionally GCP_LOCATION, GEMINI_MODEL) to ../env.sh.

Teardown (removes containers, volumes, image):

    docker compose down -v --rmi local
