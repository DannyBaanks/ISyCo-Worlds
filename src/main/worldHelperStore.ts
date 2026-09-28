import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WorldHelperPersistedState } from './worldHelperHost';

const FILE_NAME = 'world-helper.json';
const PROVIDERS = new Set(['nvidia-nim', 'openai', 'anthropic']);

export function worldHelperStatePath(userDataPath: string): string {
  return join(userDataPath, FILE_NAME);
}

function isPersistedState(value: unknown): value is WorldHelperPersistedState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return (state.provider === null || typeof state.provider === 'string' && PROVIDERS.has(state.provider))
    && (state.model === null || typeof state.model === 'string')
    && typeof state.enabled === 'boolean'
    && typeof state.onboardingComplete === 'boolean'
    && (state.setupDismissed === undefined || typeof state.setupDismissed === 'boolean')
    && Array.isArray(state.transcript)
    && Array.isArray(state.notices)
    && Array.isArray(state.seenEvents)
    && (state.errorCategory === undefined || typeof state.errorCategory === 'string');
}

function emptyState(): WorldHelperPersistedState {
  return {
    provider: null,
    model: null,
    enabled: false,
    onboardingComplete: false,
    transcript: [],
    notices: [],
    seenEvents: []
  };
}

/** Read app-private helper state; malformed/missing data never blocks app boot. */
export function readWorldHelperState(userDataPath: string): WorldHelperPersistedState {
  const path = worldHelperStatePath(userDataPath);
  if (!existsSync(path)) return emptyState();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyState();
    const document = parsed as Record<string, unknown>;
    if (document.version !== 1 || !isPersistedState(document.state)) return emptyState();
    return document.state;
  } catch {
    return emptyState();
  }
}

/** Atomically persist bounded GUS state in Electron userData, never in a Hive. */
export function writeWorldHelperState(userDataPath: string, state: WorldHelperPersistedState): void {
  if (!isPersistedState(state)) throw new Error('invalid World Helper state');
  const path = worldHelperStatePath(userDataPath);
  const tempPath = `${path}.${randomBytes(8).toString('hex')}.tmp`;
  mkdirSync(userDataPath, { recursive: true });
  try {
    const bounded: WorldHelperPersistedState = {
      ...state,
      transcript: state.transcript.slice(-80),
      notices: state.notices.slice(-80),
      seenEvents: state.seenEvents.slice(-500)
    };
    writeFileSync(tempPath, `${JSON.stringify({ version: 1, state: bounded }, null, 2)}\n`, {
      encoding: 'utf8', mode: 0o600, flag: 'wx'
    });
    renameSync(tempPath, path);
  } catch (error) {
    try { unlinkSync(tempPath); } catch { /* absent or already promoted */ }
    throw error;
  }
}
