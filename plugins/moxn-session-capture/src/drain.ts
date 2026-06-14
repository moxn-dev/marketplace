#!/usr/bin/env node
import { join } from 'node:path';
import { homedir } from 'node:os';
import { drainSpool } from '../../../src/lib/sessions/drain';
import { spoolFromPayload } from '../../../src/lib/sessions/hook';
import { markSynced } from '../../../src/lib/sessions/spool';
import { syncTranscript } from '../../../src/lib/sessions/sync';
import { config, captureEnabled } from './config';
const SPOOL =
  process.env.MOXN_SESSIONS_SPOOL_DIR ?? join(homedir(), '.moxn', 'sessions-spool');

/** Read the SessionStart stdin payload (don't hang if none was piped). */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let d = '';
    const t = setTimeout(() => resolve(d), 1500);
    process.stdin.on('data', (c) => (d += c));
    process.stdin.on('end', () => {
      clearTimeout(t);
      resolve(d);
    });
  });
}

async function main() {
  if (!captureEnabled()) return; // capture disabled — no spool, no drain, no sync
  // 1) REGISTER the current session (SessionStart payload): spool it so a later
  //    crash leaves a stale record the next session's drain reconciles, and
  //    sync its start state immediately (status=active — visible at start).
  const stdin = await readStdin();
  const self = stdin.trim()
    ? spoolFromPayload(stdin, {
        spoolDir: SPOOL,
        debugDir: process.env.MOXN_SESSIONS_DEBUG_DIR || undefined,
      })
    : null;

  const { apiKey, baseUrl } = config();
  if (!apiKey) return; // unconfigured: spool (above) still registered; never error

  if (self) {
    try {
      await syncTranscript(self.transcriptPath, { baseUrl, apiKey, status: 'active' });
      markSynced(SPOOL, self.sessionId);
    } catch (e) {
      // leave self stale — a later checkpoint or the next drain recovers it
      console.error('[session-capture:drain] self-sync', (e as Error).message);
    }
  }

  // 2) DRAIN everything else that's stale (crashed/unsynced past sessions).
  const n = await drainSpool({ spoolDir: SPOOL, baseUrl, apiKey });
  console.log(
    `[session-capture:drain] self=${self ? 'registered' : 'none'} synced=${n}`,
  );
}
main().catch((e) => console.error('[session-capture:drain]', (e as Error).message));
