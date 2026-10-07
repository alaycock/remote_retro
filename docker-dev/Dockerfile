# Throwaway dev image matching .tool-versions (Erlang 22.3.4.16 / Elixir 1.11.4 / Node 14.16.0)
FROM hexpm/elixir:1.11.4-erlang-22.3.4.16-debian-buster-20210208

# buster is EOL; point apt at the archive
RUN sed -i 's|deb.debian.org|archive.debian.org|g; s|security.debian.org|archive.debian.org|g; /buster-updates/d' /etc/apt/sources.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates xz-utils git build-essential python3 inotify-tools postgresql-client \
 && rm -rf /var/lib/apt/lists/*

ARG NODE_VERSION=14.16.0
RUN arch=$(dpkg --print-architecture | sed 's/amd64/x64/') \
 && curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${arch}.tar.xz \
    | tar -xJ -C /usr/local --strip-components=1 \
 && npm install -g yarn@1.22.0

ENV MIX_HOME=/opt/mix HEX_HOME=/opt/hex LANG=C.UTF-8
RUN mix local.hex --force && mix local.rebar --force

WORKDIR /app
