---
name: moxn
description: Use the Moxn knowledge base and captured agent sessions via the moxn MCP server — find/read/search KB docs, and pull the reasoning behind code or a pull request from past sessions. Use when the user asks about prior decisions, why code looks a certain way, what a teammate was doing, or to search team docs/specs.
---

# Moxn: knowledge base + session context for your agent

This plugin connects you to Moxn through the `moxn` MCP server. Its tools surface as
`mcp__moxn__*` (find / read / search / edit / sessions / …). There are two surfaces.

## Knowledge base (durable team docs)

- `find` — list/locate documents and folders by path or name.
- `read` — read a document or section (returns moxn-grammar markdown).
- `search` — full-text search across document sections.

Ground answers in the team's durable docs (specs, architecture, decisions) instead of
guessing. Start with `find`/`search` to discover, then `read` for the content.

## Captured sessions (the reasoning behind the code)

Past coding-agent sessions are captured into Moxn. Use the `sessions` action to recover
*why* something was done, not just what changed:

- `sessions find` — sessions by `repoKey`, `branch`, `filePath`, commit `sha`, or **`pr`**
  (`"#123"` or `"owner/repo#123"` → the sessions whose source branch is that PR's head
  branch, across **all contributors**, scoped to your workspace).
- `sessions search` — full-text search across session turn text, optionally scoped by
  `pr` / `branch` / `repoKey`.
- `sessions read` — a session's mechanical decision-record, or a transcript window
  (`transcript: { turns: "40..48" }`) or one subagent thread (`transcript: { thread: "<agentId>" }`).

### Recipe — the reasoning behind a PR you're reviewing
1. `sessions find { pr: "#<n>" }` → the sessions that produced the PR (every contributor).
2. `sessions search { pr: "#<n>", q: "why <X>" }` → the relevant turns.
3. `sessions read { sessionId, transcript: { turns: "<a>..<b>" } }` → read the reasoning.

If a PR can't be resolved (the GitHub App isn't connected), pass `branch` directly instead.

### Recipe — "why does this file look like this?"
`sessions find { filePath: "src/lib/foo.ts" }` → read the decision-record of the session
that last shaped it.

## Workspace scope & auth

- **One connection = one workspace.** This plugin's `moxn` MCP server is hard-scoped to a
  single Moxn workspace (the `workspace` you set at install → `<workspace>.moxn.dev`). The
  server enforces it: every call is checked against your membership in that one workspace, so
  a connection can never read or write another workspace's content.
- **Reads** authenticate via **OAuth** — Claude Code prompts you to authorize Moxn once, then
  caches the token. No API key to paste.
- **To work in a second workspace**, add a second, independent connection (and authorize it
  separately): `claude mcp add moxn-<other> --transport http https://<other>.moxn.dev/api/mcp/http`.
- **Session-capture hooks** (the background writes) use a scoped, revocable key in
  `~/.moxn/agent.json`; configure it once per the plugin README. Nothing is stored in the repo.
