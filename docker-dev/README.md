# Containerized dev setup

Postgres 17 + an app container (Elixir 1.20 / OTP 28, Node 24). Build artifacts and the
database live in Docker volumes, so nothing is installed on the host.

    docker compose up -d     # http://localhost:4000

Setup, configuration (`../env.sh`), Gemini credentials, email preview and teardown are all
documented in the [root README](../README.md#development).
