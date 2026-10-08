# Remote Retro

Real-time retrospectives for distributed teams: collect ideas, group them on a shared
pan/zoom board (with optional Gemini assistance), label, vote, and leave with action items.

Stack: Elixir 1.20 / Phoenix 1.8 / Postgres 17, React 19 + TypeScript + Redux Toolkit,
Tailwind v4 + daisyUI. Real-time over Phoenix Channels.

## Development

Everything runs in containers (see [`docker-dev/README.md`](docker-dev/README.md)):

    cd docker-dev
    docker compose up -d        # http://localhost:4000

Sign in with Google (credentials in a gitignored `env.sh` at the repo root) or, in dev,
via `http://localhost:4000/dev/login?email=you@example.com`.

## Retro flow

`lobby → prime-directive → idea-generation → grouping → labeling → voting → action-items → closed`

- The facilitator moves one stage forward or back; going back from `closed` re-opens the retro.
- Grouping: drag stickies so they overlap to form a group; label groups inline. The board is
  unbounded — pan by dragging empty space, zoom with ctrl/⌘-scroll, pinch, or the controls.
- With `GCP_PROJECT` set, Gemini (Vertex AI) does a conservative first pass at grouping when the
  grouping stage starts, and suggests labels for unlabeled groups when labeling starts.

## Configuration

| Env var | Purpose |
|---|---|
| `REMOTE_RETRO_GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | Google sign-in |
| `GCP_PROJECT` | Enables Gemini grouping/labelling (unset = off) |
| `GCP_LOCATION` | Vertex location, default `global` |
| `GEMINI_MODEL` | Default `gemini-2.5-flash` |
| `GOOGLE_APPLICATION_CREDENTIALS` | ADC file (service account, user, or impersonated); else metadata server |

The Gemini identity needs `roles/aiplatform.user` on `GCP_PROJECT`.
