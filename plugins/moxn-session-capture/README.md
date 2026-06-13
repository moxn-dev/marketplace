# moxn-session-capture

Claude Code plugin that captures your sessions into Moxn bronze. Lifecycle hooks
sync **redacted**, **de-noised** transcripts (current-head convergence — rewinds
collapse to the surviving head) with binary assets externalized to blob storage,
never inlined.

- **SessionStart** → registers the current session (spool + immediate `active` sync) and drains any stale/crashed past sessions.
- **PreCompact** → checkpoints the transcript before compaction can truncate it.
- **SessionEnd** → final sync with `complete` status.

All hooks are `async` and never block the agent. Entries in `dist/` are
esbuild-bundled single files — no `npx`, `tsx`, or `node_modules` needed at
runtime, only `node` on PATH.

## Setup

Write `~/.moxn/agent.json` once (machine-global config):

```bash
node dist/setup.cjs --api-key=<moxn api key> --base-url=https://moxn.dev
```

`--base-url` defaults to `https://moxn.dev`. Without a configured key the hooks
still spool session records locally (durable, recovered by a later drain) but
skip syncing.

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
