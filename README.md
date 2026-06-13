# Moxn — plugin marketplace for coding agents

Install the Moxn plugin in Claude Code:

```
/plugin marketplace add moxn-dev/marketplace
/plugin install moxn-session-capture@moxn
```

## What you get
- **Session capture** — your sessions are captured into your Moxn workspace (redacted, de-noised) via lifecycle hooks.
- **Knowledge + session tools (MCP)** — read/search your Moxn knowledge base and the reasoning behind past sessions and PRs, from your agent.
- **The `moxn` skill** — teaches your agent when and how to use the above.

## Auth
- The **MCP** authenticates via OAuth — authorize Moxn once via `/mcp`.
- The **capture hooks** use a scoped, revocable key in `~/.moxn/agent.json` (see the plugin README).

Requires a [Moxn](https://moxn.dev) account.
