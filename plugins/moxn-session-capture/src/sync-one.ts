#!/usr/bin/env node
import { join } from 'node:path';
import { homedir } from 'node:os';
import { syncTranscript } from '../../../src/lib/sessions/sync';
import { markSynced } from '../../../src/lib/sessions/spool';
import { config } from './config';
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
