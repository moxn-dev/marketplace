#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { syncTranscript } from '../../../src/lib/sessions/sync';
import { markSynced } from '../../../src/lib/sessions/spool';

function config(): { apiKey?: string; baseUrl: string } {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.moxn', 'agent.json'), 'utf-8'));
  } catch {
    return {
      apiKey: process.env.MOXN_API_KEY,
      baseUrl: process.env.MOXN_BASE_URL ?? 'http://localhost:3001',
    };
  }
}
const SPOOL =
  process.env.MOXN_SESSIONS_SPOOL_DIR ?? join(homedir(), '.moxn', 'sessions-spool');

async function main() {
  const [, , transcriptPath, sessionId, status] = process.argv;
  const { apiKey, baseUrl } = config();
  if (!apiKey || !transcriptPath) return; // never error — spool + drain recover
  await syncTranscript(transcriptPath, {
    baseUrl,
    apiKey,
    status: status === 'complete' ? 'complete' : 'active',
  });
  if (sessionId) markSynced(SPOOL, sessionId);
}
main().catch((e) => console.error('[session-capture:sync-one]', (e as Error).message));
