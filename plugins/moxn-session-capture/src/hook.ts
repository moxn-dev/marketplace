#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spoolFromPayload } from '../../../src/lib/sessions/hook';

const SPOOL =
  process.env.MOXN_SESSIONS_SPOOL_DIR ?? join(homedir(), '.moxn', 'sessions-spool');

async function main() {
  const stdin = await new Promise<string>((resolve) => {
    let d = '';
    process.stdin.on('data', (c) => (d += c));
    process.stdin.on('end', () => resolve(d));
  });
  const spooled = spoolFromPayload(stdin, {
    spoolDir: SPOOL,
    debugDir: process.env.MOXN_SESSIONS_DEBUG_DIR || undefined,
  });
  if (spooled) {
    const status = spooled.event === 'SessionEnd' ? 'complete' : 'active';
    // Spawn the BUNDLED worker with this same node binary; detached so it
    // survives both this hook and the session process tree.
    spawn(
      process.execPath,
      [
        '--max-old-space-size=6144',
        join(__dirname, 'sync-one.cjs'),
        spooled.transcriptPath,
        spooled.sessionId,
        status,
      ],
      { detached: true, stdio: 'ignore' },
    ).unref();
  }
  process.exit(0); // never block the agent
}
main();
