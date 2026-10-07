# Throwaway containerized dev setup

Everything (Postgres 13, Erlang 22 / Elixir 1.11.4, Node 14.16) runs in OrbStack.
deps/, _build/, node_modules/ and the DB live in Docker volumes, not on the host.


    cd docker-dev
    docker compose up -d                 # app at http://localhost:4000, webpack on :8080, pg on :5432
    docker compose logs -f app
    docker compose run --rm app mix test
    docker compose run --rm app yarn test
    docker compose exec app bash         # shell inside running app

Google OAuth login: export REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID / _SECRET in your shell
before `docker compose up` (see root README). Redirect URI defaults to
http://localhost:4000/auth/google/callback.

If you re-run `yarn install`, restore the semantic CSS afterwards (GNU cp nests
the dir instead of merging like macOS cp does):

    rm -rf ../priv/static/css/semantic-ui/semantic-ui-offline && git -C .. checkout priv/static/css/semantic-ui/semantic.min.css
    docker compose run --rm app bash -c 'sed "s|semantic-ui-offline/ |semantic-ui-offline/. |" bin/prepare_semantic_ui_for_consumption_by_phoenix | bash'

Teardown (removes containers, volumes, image):

    docker compose down -v --rmi local && rm -rf ../docker-dev
    # plus gitignored build output left in the repo:
    git -C .. clean -fdX priv/static web/static/js/dll
