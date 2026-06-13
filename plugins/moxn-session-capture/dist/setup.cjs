#!/usr/bin/env node
"use strict";

// src/setup.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_os = require("node:os");
function arg(n, d) {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
}
var apiKey = arg("api-key", process.env.MOXN_API_KEY);
var baseUrl = arg("base-url", "https://moxn.dev");
if (!apiKey) {
  console.error(
    "usage: node setup.cjs --api-key=<moxn api key> [--base-url=https://moxn.dev]"
  );
  process.exit(1);
}
(0, import_node_fs.mkdirSync)((0, import_node_path.join)((0, import_node_os.homedir)(), ".moxn"), { recursive: true });
(0, import_node_fs.writeFileSync)(
  (0, import_node_path.join)((0, import_node_os.homedir)(), ".moxn", "agent.json"),
  JSON.stringify({ apiKey, baseUrl }, null, 2) + "\n"
);
console.log(`[session-capture] wrote ~/.moxn/agent.json (baseUrl=${baseUrl})`);
