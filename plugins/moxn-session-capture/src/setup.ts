#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

function arg(n: string, d?: string): string | undefined {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split('=').slice(1).join('=') : d;
}
const apiKey = arg('api-key', process.env.MOXN_API_KEY);
const baseUrl = arg('base-url', 'https://moxn.dev');
if (!apiKey) {
  console.error(
    'usage: node setup.cjs --api-key=<moxn api key> [--base-url=https://moxn.dev]',
  );
  process.exit(1);
}
mkdirSync(join(homedir(), '.moxn'), { recursive: true });
writeFileSync(
  join(homedir(), '.moxn', 'agent.json'),
  JSON.stringify({ apiKey, baseUrl }, null, 2) + '\n',
);
console.log(`[session-capture] wrote ~/.moxn/agent.json (baseUrl=${baseUrl})`);
