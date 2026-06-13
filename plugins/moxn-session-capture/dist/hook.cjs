#!/usr/bin/env node
"use strict";

// src/hook.ts
var import_node_child_process = require("node:child_process");
var import_node_path3 = require("node:path");
var import_node_os = require("node:os");

// ../../src/lib/sessions/hook.ts
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");

// ../../src/lib/sessions/spool.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
function fileFor(dir, id) {
  return (0, import_node_path.join)(dir, `${id.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);
}
function readOne(dir, id) {
  try {
    return JSON.parse((0, import_node_fs.readFileSync)(fileFor(dir, id), "utf-8"));
  } catch {
    return void 0;
  }
}
function writeSpool(dir, rec) {
  (0, import_node_fs.mkdirSync)(dir, { recursive: true });
  const prev = readOne(dir, rec.sessionId);
  const merged = { ...rec, lastSyncedAt: prev?.lastSyncedAt };
  const tmp = fileFor(dir, rec.sessionId) + ".tmp";
  (0, import_node_fs.writeFileSync)(tmp, JSON.stringify(merged));
  (0, import_node_fs.renameSync)(tmp, fileFor(dir, rec.sessionId));
}

// ../../src/lib/sessions/hook.ts
function spoolFromPayload(stdin, deps) {
  if (deps.debugDir) {
    try {
      (0, import_node_fs2.mkdirSync)(deps.debugDir, { recursive: true });
      (0, import_node_fs2.writeFileSync)((0, import_node_path2.join)(deps.debugDir, `payload-${Date.now()}.json`), stdin);
    } catch {
    }
  }
  let p;
  try {
    p = JSON.parse(stdin);
  } catch {
    return null;
  }
  const sessionId = p?.session_id;
  const transcriptPath = p?.transcript_path;
  if (!sessionId || !transcriptPath) return null;
  const event = p?.hook_event_name ?? "unknown";
  try {
    writeSpool(deps.spoolDir, {
      sessionId,
      transcriptPath,
      cwd: p?.cwd ?? "",
      tool: "claude_code",
      event,
      ts: (deps.now?.() ?? Date.now()) / 1e3
    });
  } catch {
  }
  return { sessionId, transcriptPath, event };
}

// src/hook.ts
var SPOOL = process.env.MOXN_SESSIONS_SPOOL_DIR ?? (0, import_node_path3.join)((0, import_node_os.homedir)(), ".moxn", "sessions-spool");
async function main() {
  const stdin = await new Promise((resolve) => {
    let d = "";
    process.stdin.on("data", (c) => d += c);
    process.stdin.on("end", () => resolve(d));
  });
  const spooled = spoolFromPayload(stdin, {
    spoolDir: SPOOL,
    debugDir: process.env.MOXN_SESSIONS_DEBUG_DIR || void 0
  });
  if (spooled) {
    const status = spooled.event === "SessionEnd" ? "complete" : "active";
    (0, import_node_child_process.spawn)(
      process.execPath,
      [
        "--max-old-space-size=6144",
        (0, import_node_path3.join)(__dirname, "sync-one.cjs"),
        spooled.transcriptPath,
        spooled.sessionId,
        status
      ],
      { detached: true, stdio: "ignore" }
    ).unref();
  }
  process.exit(0);
}
main();
