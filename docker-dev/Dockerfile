# Throwaway dev image: Elixir 1.20 / OTP 28 + Node 24 LTS
FROM hexpm/elixir:1.20.4-erlang-28.5.0.7-debian-bookworm-20261005

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates xz-utils git build-essential inotify-tools postgresql-client \
 && rm -rf /var/lib/apt/lists/*

ARG NODE_VERSION=24.21.0
RUN arch=$(dpkg --print-architecture | sed 's/amd64/x64/') \
 && curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${arch}.tar.xz \
    | tar -xJ -C /usr/local --strip-components=1

ENV MIX_HOME=/opt/mix HEX_HOME=/opt/hex LANG=C.UTF-8
RUN mix local.hex --force && mix local.rebar --force && mix archive.install hex phx_new 1.8.15 --force

WORKDIR /app
