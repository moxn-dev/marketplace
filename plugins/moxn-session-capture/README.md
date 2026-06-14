# moxn-session-capture

The Moxn plugin for your coding agent — two surfaces in one install:

1. **Session capture** — lifecycle hooks sync your sessions into Moxn bronze:
   **redacted**, **de-noised** transcripts (current-head convergence — rewinds
   collapse to the surviving head) with binary assets externalized to blob
   storage, never inlined.
2. **Knowledge + session tools (MCP)** — the bundled `moxn` MCP server lets your
   agent read/search your Moxn knowledge base and the reasoning behind past
   sessions and PRs (see `skills/moxn`). Authenticates via OAuth and is
   **hard-scoped to one workspace** (set at install; enforced server-side).

- **SessionStart** → registers the current session (spool + immediate `active` sync) and drains any stale/crashed past sessions.
- **PreCompact** → checkpoints the transcript before compaction can truncate it.
- **SessionEnd** → final sync with `complete` status.

All hooks are `async` and never block the agent. Entries in `dist/` are
esbuild-bundled single files — no `npx`, `tsx`, or `node_modules` needed at
runtime, only `node` on PATH.

## Setup

Everything is configured **at install** — the `/plugin` UI prompts for the fields
below (or pass them with `--config`), then authorize the MCP once via `/mcp`:

```bash
claude plugin install moxn-session-capture@moxn \
  --config workspace=acme \
  --config api_key=<your moxn api key for that workspace>
```

- **`workspace`** (required) → the `moxn` MCP connects to
  `https://<workspace>.moxn.dev/api/mcp/http`, **hard-scoped to that one workspace**
  (membership-enforced server-side). Authorize it once via `/mcp` — OAuth, no key
  needed for reads. To work in a second workspace, add an independent connection:
  `claude mcp add moxn-other --transport http https://<other>.moxn.dev/api/mcp/http`.
- **`api_key`** (optional, stored in your OS keychain) → the background capture
  hooks use it to sync your sessions. Without it the hooks spool locally (durable,
  recovered by a later drain) and skip syncing. Get one at `moxn.dev/settings/api-keys`.

### Alternative: file-based key (settings-hook installs)

If you wire the hooks via `settings.json` rather than the marketplace plugin,
configure the key in a file instead of the install prompt:

```bash
node dist/setup.cjs --api-key=<moxn api key> --base-url=https://moxn.dev
```

The hooks resolve config in precedence order: plugin `api_key`
(`CLAUDE_PLUGIN_OPTION_API_KEY`) → `~/.moxn/agent.json` → `MOXN_API_KEY` /
`MOXN_BASE_URL` env. Base URL defaults to `https://moxn.dev`.

## Privacy & disabling capture

Capture is opt-in for network sync and fully toggleable:

- **No API key → nothing is transmitted.** The hooks never make a network call
  without a configured key (`if (!apiKey) return` precedes every request). Without
  a key they write only a small local *pointer* record (session id + the path to
  Claude Code's own transcript) to `~/.moxn/sessions-spool` — never a copy of your
  session, never sent.
- **`capture_enabled: false` → nothing at all.** Set it (the install prompt, or
  `MOXN_CAPTURE_ENABLED=false`) and the hooks no-op entirely — no local spooling,
  no sync — independent of any key.
- The **MCP** (reads/search) never transmits your session logs; it's read-only and
  authenticates with OAuth, not the capture key.

So for zero capture, set `capture_enabled` off (or simply never configure a key —
that already guarantees nothing leaves the machine). Reads still work either way.

## Local test

```bash
claude --plugin-dir packages/session-capture
```

## Env override knobs

| Variable | Effect |
|---|---|
| `MOXN_SESSIONS_SPOOL_DIR` | Override the spool dir (default `~/.moxn/sessions-spool`, machine-global by design) |
| `MOXN_SESSIONS_DEBUG_DIR` | If set, dump raw hook stdin payloads there (payload-shape debugging) |
| `MOXN_API_KEY` / `MOXN_BASE_URL` | Fallback config when `~/.moxn/agent.json` is absent |

## Coexistence with settings-installed hooks

Plugin hooks MERGE with hooks installed in `settings.json` — both fire. That's
harmless (sync is idempotent; you just sync twice), but uninstall one of the
two to avoid the redundant work.

## Rebuilding

```bash
npm install && npm run build   # inside packages/session-capture
```

`dist/*.cjs` are committed so the plugin runs without any install step.

## Distribution

This package is the **canonical source** (TypeScript, tests, esbuild build). It is
published — as a build artifact — to the public marketplace repo
**[moxn-dev/marketplace](https://github.com/moxn-dev/marketplace)**, which is what
users install from:

```
/plugin marketplace add moxn-dev/marketplace
/plugin install moxn-session-capture@moxn
```

(Per the Marketplaces V1 model, GitHub is authoritative for distributed content; the
marketplace repo is the install surface, this package is where the plugin is built.)

To publish an update, from this directory:

```bash
./publish-to-marketplace.sh /path/to/moxn-dev/marketplace   # checkout of the repo
# then review + commit + push in that checkout
```
