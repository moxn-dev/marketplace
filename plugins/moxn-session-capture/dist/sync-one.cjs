#!/usr/bin/env node
"use strict";

// src/sync-one.ts
var import_node_path4 = require("node:path");
var import_node_os2 = require("node:os");

// ../../src/lib/sessions/sync.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_child_process = require("node:child_process");
var import_node_zlib = require("node:zlib");

// ../../src/lib/sessions/types.ts
var INLINE_CONTENT_MAX_BYTES = 8 * 1024;

// ../../src/lib/sessions/identity.ts
function normalizeRemoteUrl(url) {
  if (!url) return null;
  let s = url.trim();
  if (!s) return null;
  const hasScheme = /:\/\//.test(s);
  if (!hasScheme && /^[^@]+@[^:]+:/.test(s)) {
    const m = s.match(/^[^@]+@([^:]+):(.+)$/);
    s = `${m[1]}/${m[2]}`;
  } else {
    s = s.replace(/^[a-z]+:\/\//i, "").replace(/^[^@/]+@/, "");
  }
  s = s.replace(/^([^/]+):\d+\//, "$1/");
  s = s.replace(/\.git$/, "").replace(/\/+$/, "");
  return s || null;
}
function stripUrlCredentials(url) {
  if (!url) return null;
  return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@\s]*@/i, "$1") || null;
}
function resolveRepoIdentity(input) {
  const ws = input.worktreeSession ?? {};
  const originalCwd = ws.originalCwd ?? input.cwd ?? null;
  const repoRemoteUrl = stripUrlCredentials(input.probedRemoteUrl);
  const repoKey = normalizeRemoteUrl(repoRemoteUrl) ?? (originalCwd ? `path:${originalCwd}` : "unknown");
  return {
    repoKey,
    repoRemoteUrl,
    originalCwd,
    worktreeName: ws.worktreeName ?? null,
    worktreeBranch: ws.worktreeBranch ?? null,
    worktreePath: ws.worktreePath ?? null,
    originalBranch: ws.originalBranch ?? null,
    originalHeadCommit: ws.originalHeadCommit ?? null
  };
}

// ../../src/lib/sessions/adapters/claude-code.ts
var ATTR_KEYS = {
  attributionSkill: "skill",
  attributionMcpServer: "mcpServer",
  attributionMcpTool: "mcpTool",
  attributionPlugin: "plugin"
};
var META_TYPES = /* @__PURE__ */ new Set([
  "permission-mode",
  "mode",
  "last-prompt",
  "ai-title",
  "queue-operation",
  "file-history-snapshot",
  "attachment",
  "system"
]);
function firstToolUse(content) {
  if (Array.isArray(content)) {
    for (const b of content) {
      if (b && typeof b === "object" && b.type === "tool_use") {
        return { name: b.name ?? null, id: b.id ?? null };
      }
    }
  }
  return { name: null, id: null };
}
function allToolUseNames(content) {
  if (!Array.isArray(content)) return [];
  return content.filter(
    (b) => b && typeof b === "object" && b.type === "tool_use" && typeof b.name === "string"
  ).map((b) => b.name);
}
function pickAttribution(line) {
  const out = {};
  for (const [k, label] of Object.entries(ATTR_KEYS)) {
    const v = line[k];
    if (typeof v === "string" && v) out[label] = v;
  }
  return Object.keys(out).length ? out : null;
}
function parseClaudeCodeLines(parsed, opts = {}) {
  const tool = "claude_code";
  const events = parsed.map((line, seq) => {
    const message = line.message ?? {};
    const content = message.content ?? null;
    const tu = firstToolUse(content);
    const contentBytes = content == null ? 0 : Buffer.byteLength(JSON.stringify(content), "utf-8");
    const tooLarge = contentBytes > INLINE_CONTENT_MAX_BYTES;
    return {
      eventUuid: String(line.uuid ?? `seq-${seq}`),
      parentUuid: line.parentUuid ?? null,
      seq,
      type: String(line.type ?? "unknown"),
      role: message.role ?? null,
      isSidechain: line.isSidechain === true,
      isMeta: line.isMeta === true || META_TYPES.has(String(line.type)),
      gitBranch: line.gitBranch ?? null,
      cwd: line.cwd ?? null,
      timestamp: String(line.timestamp ?? ""),
      toolName: tu.name ?? line.toolName ?? null,
      toolUseId: tu.id ?? line.sourceToolUseID ?? null,
      attribution: pickAttribution(line),
      content: tooLarge ? null : content,
      contentTooLarge: tooLarge
    };
  });
  const sessionId = String(parsed.find((l) => l.sessionId)?.sessionId ?? "unknown");
  const worktreeSession = parsed.find((l) => l.worktreeSession)?.worktreeSession;
  const cwd = parsed.find((l) => l.cwd)?.cwd;
  const repo = resolveRepoIdentity({
    worktreeSession,
    cwd,
    probedRemoteUrl: opts.probedRemoteUrl
  });
  const timestamps = events.map((e) => e.timestamp).filter(Boolean).sort();
  const sidechainUuids = new Set(
    events.filter((e) => e.isSidechain).map((e) => e.eventUuid)
  );
  const threadCount = 1 + events.filter(
    (e) => e.isSidechain && e.type !== "agent-meta" && (e.parentUuid == null || !sidechainUuids.has(e.parentUuid))
  ).length;
  const ccVersion = parsed.find((l) => l.version)?.version ?? null;
  const uniq = (xs) => [
    ...new Set(xs.filter((x) => typeof x === "string" && !!x))
  ];
  const gitBranches = uniq(events.map((e) => e.gitBranch));
  const toolNames = uniq(
    parsed.flatMap(
      (l) => allToolUseNames(l.message?.content)
    )
  );
  const attribution = {
    skills: uniq(parsed.map((l) => l.attributionSkill)),
    mcpServers: uniq(parsed.map((l) => l.attributionMcpServer)),
    plugins: uniq(parsed.map((l) => l.attributionPlugin))
  };
  return {
    tool,
    sessionId,
    repo,
    startedAt: timestamps[0] ?? "",
    lastEventAt: timestamps[timestamps.length - 1] ?? "",
    eventCount: events.length,
    threadCount,
    ccVersion,
    gitBranches,
    toolNames,
    attribution,
    events
  };
}

// ../../src/lib/sessions/redact.ts
var REDACTION_VERSION = 1;
var REDACTED = "[[redacted]]";
var PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  // Anthropic
  /sk-[A-Za-z0-9]{16,}/g,
  // OpenAI-style
  /moxn_[A-Za-z0-9_]{8,}/g,
  // Moxn API keys
  /\b[rsp]k_(?:live|test)_[A-Za-z0-9]{16,}/g,
  // Stripe/Clerk secret/restricted/publishable
  /\bwhsec_[A-Za-z0-9]{16,}/g,
  // Stripe webhook signing
  /\b(?:gh[opsu]|github_pat)_[A-Za-z0-9_]{20,}/g,
  // GitHub (PAT/OAuth/server/user)
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
  // Slack
  /\bnpm_[A-Za-z0-9]{36}/g,
  // npm
  /\bAIza[A-Za-z0-9_-]{35,}/g,
  // Google API
  /AKIA[0-9A-Z]{16}/g,
  // AWS access key id
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // JWT
  /Bearer\s+[\w.~+/=-]{12,}/gi,
  // bearer tokens (case-insensitive; opaque/base64)
  /Authorization\s*[:=]\s*(?:Bearer|Basic|Token|Bot|Digest)?\s*[\w.~+/=-]{6,}/gi,
  // auth header value incl. scheme word
  /\b([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD))\b\s*[:=]\s*(?:["'][^"'\n]{4,}["']|[A-Za-z0-9_\-./+@]*\d[A-Za-z0-9_\-./+@]*|[A-Za-z0-9_\-./+@]{16,})/gi,
  // KEY=VALUE (token-shaped value)
  /sb[a-z]?_[A-Za-z0-9]{20,}/g
  // Supabase service/anon keys
];
function redactText(text) {
  let out = text;
  out = out.replace(
    /\b([a-z][a-z0-9+.-]*:\/\/[^/\s:@]+):([^@\s/]+)@/gi,
    `$1:${REDACTED}@`
  );
  for (const re of PATTERNS) {
    out = out.replace(re, (m) => {
      const eq = m.match(/^([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*)/i);
      if (eq) return `${eq[1]}${REDACTED}`;
      const auth = m.match(/^((?:Authorization|Bearer)\s*[:=]?\s*)/i);
      if (auth) return `${auth[1]}${REDACTED}`;
      return REDACTED;
    });
  }
  return out;
}
function redactJson(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactJson);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactJson(v);
    return out;
  }
  return value;
}

// ../../src/lib/sessions/content-transform.ts
var import_node_crypto = require("node:crypto");
var PLUMBING_ATTACHMENT_KINDS = /* @__PURE__ */ new Set([
  "task_reminder",
  "hook_success",
  "deferred_tools_delta",
  "mcp_instructions_delta",
  "skill_listing",
  "compact_file_reference",
  "queued_command"
]);
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isPlumbingLine(line) {
  if (!isPlainObject(line)) return false;
  if (line.type === "file-history-snapshot") return true;
  if (line.type === "attachment") {
    const attachment = line.attachment;
    if (isPlainObject(attachment) && typeof attachment.type === "string") {
      return PLUMBING_ATTACHMENT_KINDS.has(attachment.type);
    }
  }
  return false;
}
function extFromMime(mediaType) {
  const sub = (mediaType.split("/")[1] ?? "").split("+")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
  return (sub || "bin").slice(0, 8);
}
function isInlineBase64Source(node) {
  const source = node.source;
  return isPlainObject(source) && source.type === "base64" && typeof source.data === "string";
}
function externalizeBase64Source(node, assets) {
  const source = node.source;
  const mediaType = typeof source.media_type === "string" ? source.media_type : "application/octet-stream";
  const bytes = Buffer.from(source.data, "base64");
  const sha256 = (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
  const ext = extFromMime(mediaType);
  if (!assets.has(sha256)) {
    assets.set(sha256, { bytes, mediaType, ext });
  }
  node.source = {
    type: "storage",
    key: `assets/${sha256}.${ext}`,
    media_type: mediaType,
    sha256,
    bytes: bytes.length
  };
}
function walkAndExternalize(value, assets) {
  if (Array.isArray(value)) {
    for (const item of value) walkAndExternalize(item, assets);
    return;
  }
  if (!isPlainObject(value)) return;
  if (isInlineBase64Source(value)) {
    externalizeBase64Source(value, assets);
  }
  for (const key of Object.keys(value)) {
    walkAndExternalize(value[key], assets);
  }
}
function lineUuid(line) {
  if (isPlainObject(line) && typeof line.uuid === "string") return line.uuid;
  return void 0;
}
function lineParentUuid(line) {
  if (isPlainObject(line) && typeof line.parentUuid === "string")
    return line.parentUuid;
  return null;
}
function transformContent(lines) {
  const assets = /* @__PURE__ */ new Map();
  const out = [];
  const strippedParent = /* @__PURE__ */ new Map();
  for (const line of lines) {
    if (isPlumbingLine(line)) {
      const uuid = lineUuid(line);
      if (uuid !== void 0) strippedParent.set(uuid, lineParentUuid(line));
    }
  }
  const resolve = (uuid) => {
    const seen = /* @__PURE__ */ new Set();
    let cur = uuid;
    while (cur !== null && strippedParent.has(cur)) {
      if (seen.has(cur)) return null;
      seen.add(cur);
      cur = strippedParent.get(cur) ?? null;
    }
    return cur;
  };
  for (const line of lines) {
    try {
      if (isPlumbingLine(line)) continue;
      const parent = lineParentUuid(line);
      if (parent !== null && strippedParent.has(parent)) {
        line.parentUuid = resolve(parent);
      }
      walkAndExternalize(line, assets);
    } catch {
    }
    out.push(line);
  }
  return { lines: out, assets };
}

// ../../src/lib/sessions/sync.ts
function probeRemote(cwd) {
  try {
    return (0, import_node_child_process.execFileSync)("git", ["-C", cwd, "config", "--get", "remote.origin.url"], {
      encoding: "utf-8"
    }).trim() || null;
  } catch {
    return null;
  }
}
async function fetchWithRetry(label, input, init) {
  try {
    return await fetch(input, init);
  } catch (first) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      return await fetch(input, init);
    } catch (second) {
      const cause = second.cause;
      throw new Error(
        `${label} fetch failed twice (${cause?.code ?? ""} ${cause?.message ?? second.message})`
      );
    }
  }
}
function parseJsonl(raw) {
  return raw.split("\n").filter((l) => l.trim()).flatMap((l) => {
    try {
      return [JSON.parse(l)];
    } catch {
      return [];
    }
  });
}
function readSessionLines(transcriptPath) {
  const lines = parseJsonl((0, import_node_fs.readFileSync)(transcriptPath, "utf-8"));
  const subagentsDir = (0, import_node_path.join)(
    (0, import_node_path.dirname)(transcriptPath),
    (0, import_node_path.basename)(transcriptPath, ".jsonl"),
    "subagents"
  );
  if (!(0, import_node_fs.existsSync)(subagentsDir)) return lines;
  const sidecars = (0, import_node_fs.readdirSync)(subagentsDir).filter((f) => f.endsWith(".jsonl")).sort();
  if (sidecars.length === 0) return lines;
  for (const f of sidecars) {
    const sidecarLines = parseJsonl((0, import_node_fs.readFileSync)((0, import_node_path.join)(subagentsDir, f), "utf-8"));
    const stem = (0, import_node_path.basename)(f, ".jsonl");
    try {
      const meta = JSON.parse(
        (0, import_node_fs.readFileSync)((0, import_node_path.join)(subagentsDir, `${stem}.meta.json`), "utf-8")
      );
      const firstTs = sidecarLines[0]?.timestamp;
      lines.push({
        type: "agent-meta",
        agentId: stem.replace(/^agent-/, ""),
        agentType: typeof meta.agentType === "string" ? meta.agentType : null,
        description: typeof meta.description === "string" ? meta.description : null,
        toolUseId: typeof meta.toolUseId === "string" ? meta.toolUseId : null,
        isSidechain: true,
        timestamp: typeof firstTs === "string" ? firstTs : ""
      });
    } catch {
    }
    lines.push(...sidecarLines);
  }
  return lines.sort((a, b) => {
    const ta = typeof a.timestamp === "string" ? a.timestamp : "";
    const tb = typeof b.timestamp === "string" ? b.timestamp : "";
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}
function firstCwd(lines) {
  for (const o of lines) {
    const wt = o?.worktreeSession;
    if (typeof wt?.originalCwd === "string" && wt.originalCwd) return wt.originalCwd;
    if (typeof o?.cwd === "string" && o.cwd) return o.cwd;
  }
  return process.cwd();
}
async function syncTranscript(transcriptPath, opts) {
  const parsedLines = readSessionLines(transcriptPath);
  const probedRemoteUrl = probeRemote(firstCwd(parsedLines));
  const session = parseClaudeCodeLines(parsedLines, { probedRemoteUrl });
  const { lines: clean, assets } = transformContent(parsedLines);
  const redactedJsonLines = clean.map((l, i) => {
    try {
      return JSON.stringify(redactJson(l));
    } catch {
      return `{"_redactionError":"[[redaction-error: line ${i} unredactable]]"}`;
    }
  });
  const blobBody = (0, import_node_zlib.gzipSync)(Buffer.from(redactedJsonLines.join("\n"), "utf-8"));
  const bytes = blobBody.length;
  const base = {
    sessionId: session.sessionId,
    repoKey: session.repo.repoKey,
    events: clean.length,
    // kept (de-noised) event count
    bytes
    // gzipped blob size
  };
  if (opts.dryRun) return { ...base, created: null };
  const headers = { "content-type": "application/json", "x-api-key": opts.apiKey };
  if (assets.size > 0) {
    const list = [...assets.entries()].map(([sha256, a]) => ({ sha256, ext: a.ext }));
    const aRes = await fetchWithRetry(
      "asset-url",
      `${opts.baseUrl}/api/v1/sessions/asset-url`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          tool: session.tool,
          session_id: session.sessionId,
          assets: list
        })
      }
    );
    if (!aRes.ok) throw new Error(`asset-url ${aRes.status}: ${await aRes.text()}`);
    const { uploads } = await aRes.json();
    for (const u of uploads) {
      const a = assets.get(u.sha256);
      if (!a) continue;
      const ap = await fetchWithRetry("asset PUT", u.uploadUrl, {
        method: "PUT",
        // octet-stream so ANY externalized binary (png/jpeg/pdf/audio/…) passes
        // the bucket's mime allowlist; the true type is carried in the ref's
        // `media_type` (the source of truth), not the stored object content-type.
        headers: { "content-type": "application/octet-stream", "x-upsert": "true" },
        body: a.bytes
      });
      if (!ap.ok && ap.status !== 200)
        throw new Error(`asset PUT ${ap.status}: ${await ap.text()}`);
    }
  }
  const blobRes = await fetchWithRetry(
    "blob-url",
    `${opts.baseUrl}/api/v1/sessions/blob-url`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ tool: session.tool, session_id: session.sessionId })
    }
  );
  if (!blobRes.ok)
    throw new Error(`blob-url ${blobRes.status}: ${await blobRes.text()}`);
  const { uploadUrl, storageKey } = await blobRes.json();
  const put = await fetchWithRetry("blob PUT", uploadUrl, {
    method: "PUT",
    headers: { "content-type": "application/gzip", "x-upsert": "true" },
    body: blobBody
  });
  if (!put.ok && put.status !== 200)
    throw new Error(`blob PUT ${put.status}: ${await put.text()}`);
  const ing = await fetchWithRetry("ingest", `${opts.baseUrl}/api/v1/sessions/ingest`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      session: {
        ...session.repo,
        tool: session.tool,
        sessionId: session.sessionId,
        startedAt: session.startedAt || null,
        lastEventAt: session.lastEventAt || null,
        eventCount: clean.length,
        threadCount: session.threadCount,
        ccVersion: session.ccVersion,
        gitBranches: session.gitBranches,
        toolNames: session.toolNames,
        attribution: session.attribution,
        rawBlobKey: storageKey,
        rawByteSize: bytes,
        redactionVersion: REDACTION_VERSION,
        status: opts.status ?? "complete",
        ttlExpiresAt: null
      }
    })
  });
  if (!ing.ok) throw new Error(`ingest ${ing.status}: ${await ing.text()}`);
  const out = await ing.json();
  return { ...base, created: out.created === true };
}

// ../../src/lib/sessions/spool.ts
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");
function fileFor(dir, id) {
  return (0, import_node_path2.join)(dir, `${id.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);
}
function readOne(dir, id) {
  try {
    return JSON.parse((0, import_node_fs2.readFileSync)(fileFor(dir, id), "utf-8"));
  } catch {
    return void 0;
  }
}
function markSynced(dir, sessionId) {
  const rec = readOne(dir, sessionId);
  if (!rec) return;
  const tmp = fileFor(dir, sessionId) + ".tmp";
  (0, import_node_fs2.writeFileSync)(tmp, JSON.stringify({ ...rec, lastSyncedAt: Date.now() / 1e3 }));
  (0, import_node_fs2.renameSync)(tmp, fileFor(dir, sessionId));
}

// src/config.ts
var import_node_fs3 = require("node:fs");
var import_node_os = require("node:os");
var import_node_path3 = require("node:path");
var DEFAULT_BASE_URL = "https://moxn.dev";
function config() {
  const pluginKey = process.env.CLAUDE_PLUGIN_OPTION_API_KEY;
  if (pluginKey) {
    return { apiKey: pluginKey, baseUrl: process.env.MOXN_BASE_URL ?? DEFAULT_BASE_URL };
  }
  try {
    const fromFile = JSON.parse(
      (0, import_node_fs3.readFileSync)((0, import_node_path3.join)((0, import_node_os.homedir)(), ".moxn", "agent.json"), "utf-8")
    );
    if (fromFile.apiKey) {
      return { apiKey: fromFile.apiKey, baseUrl: fromFile.baseUrl ?? DEFAULT_BASE_URL };
    }
  } catch {
  }
  return {
    apiKey: process.env.MOXN_API_KEY,
    baseUrl: process.env.MOXN_BASE_URL ?? DEFAULT_BASE_URL
  };
}

// src/sync-one.ts
var SPOOL = process.env.MOXN_SESSIONS_SPOOL_DIR ?? (0, import_node_path4.join)((0, import_node_os2.homedir)(), ".moxn", "sessions-spool");
async function main() {
  const [, , transcriptPath, sessionId, status] = process.argv;
  const { apiKey, baseUrl } = config();
  if (!apiKey || !transcriptPath) return;
  await syncTranscript(transcriptPath, {
    baseUrl,
    apiKey,
    status: status === "complete" ? "complete" : "active"
  });
  if (sessionId) markSynced(SPOOL, sessionId);
}
main().catch((e) => console.error("[session-capture:sync-one]", e.message));
