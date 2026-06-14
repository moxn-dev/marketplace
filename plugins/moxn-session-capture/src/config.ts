import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CaptureConfig {
  apiKey?: string;
  baseUrl: string;
}

const DEFAULT_BASE_URL = 'https://moxn.dev';

/**
 * Resolve the capture config (api key + ingest base URL), in precedence order:
 *   1. Plugin user-config — `CLAUDE_PLUGIN_OPTION_API_KEY` (keychain-stored, injected
 *      into hook subprocesses by Claude Code; the marketplace-plugin install path).
 *   2. `~/.moxn/agent.json` — written by `setup.cjs` (settings-hook / legacy path).
 *   3. `MOXN_API_KEY` / `MOXN_BASE_URL` env (manual / CI).
 *
 * Base URL defaults to prod. Ingest (`/api/v1/sessions/*`) is API-key-scoped to the
 * key's tenant, so the apex host is correct regardless of workspace; set
 * `MOXN_BASE_URL` to override (e.g. http://localhost:3001 for dev).
 */
export function config(): CaptureConfig {
  const pluginKey = process.env.CLAUDE_PLUGIN_OPTION_API_KEY;
  if (pluginKey) {
    return {
      apiKey: pluginKey,
      baseUrl: process.env.MOXN_BASE_URL ?? DEFAULT_BASE_URL,
    };
  }
  try {
    const fromFile = JSON.parse(
      readFileSync(join(homedir(), '.moxn', 'agent.json'), 'utf-8'),
    ) as Partial<CaptureConfig>;
    if (fromFile.apiKey) {
      return { apiKey: fromFile.apiKey, baseUrl: fromFile.baseUrl ?? DEFAULT_BASE_URL };
    }
  } catch {
    // no agent.json — fall through to env
  }
  return {
    apiKey: process.env.MOXN_API_KEY,
    baseUrl: process.env.MOXN_BASE_URL ?? DEFAULT_BASE_URL,
  };
}
