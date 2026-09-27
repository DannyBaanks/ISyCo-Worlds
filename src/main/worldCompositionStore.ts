import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isWorldCompositionV1, type WorldCompositionV1 } from '../shared/worldComposition';
import type { WorldId } from '../shared/worlds';

const PROFILE_ID: WorldId = 'monster-trainer';
const SCENARIO_ID = 'starter-village';
const DOCUMENT_VERSION = 1;

interface StoredWorldCompositionsV1 {
  version: 1;
  layouts: { 'monster-trainer:starter-village': WorldCompositionV1 };
}

export type ReadWorldCompositionResult =
  | { ok: true; layout: WorldCompositionV1 | null }
  | { ok: false; category: 'invalid' | 'io' };
export type WriteWorldCompositionResult = { ok: true } | { ok: false; category: 'invalid' | 'io' };

export function worldCompositionsPath(userDataPath: string): string {
  return join(userDataPath, 'world-compositions.json');
}

function validRequest(profileId: unknown, scenarioId: unknown): boolean {
  return profileId === PROFILE_ID && scenarioId === SCENARIO_ID;
}

function validStoredDocument(value: unknown): value is StoredWorldCompositionsV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  if (document.version !== DOCUMENT_VERSION || !document.layouts || typeof document.layouts !== 'object' || Array.isArray(document.layouts)) return false;
  const layouts = document.layouts as Record<string, unknown>;
  return Object.keys(layouts).length === 1
    && Object.keys(layouts)[0] === 'monster-trainer:starter-village'
    && isWorldCompositionV1(layouts['monster-trainer:starter-village']);
}

export function readWorldComposition(userDataPath: string, profileId: unknown, scenarioId: unknown): ReadWorldCompositionResult {
  if (!validRequest(profileId, scenarioId)) return { ok: false, category: 'invalid' };
  const filename = worldCompositionsPath(userDataPath);
  if (!existsSync(filename)) return { ok: true, layout: null };
  let contents: string;
  try {
    contents = readFileSync(filename, 'utf8');
  } catch {
    return { ok: false, category: 'io' };
  }
  let parsed: unknown;
  try { parsed = JSON.parse(contents); } catch { return { ok: false, category: 'invalid' }; }
  if (!validStoredDocument(parsed)) return { ok: false, category: 'invalid' };
  return { ok: true, layout: parsed.layouts['monster-trainer:starter-village'] ?? null };
}

export function writeWorldComposition(userDataPath: string, profileId: unknown, layout: unknown): WriteWorldCompositionResult {
  if (profileId !== PROFILE_ID || !isWorldCompositionV1(layout) || layout.scenarioId !== SCENARIO_ID) {
    return { ok: false, category: 'invalid' };
  }
  const filename = worldCompositionsPath(userDataPath);
  const tempPath = `${filename}.${randomBytes(8).toString('hex')}.tmp`;
  const document: StoredWorldCompositionsV1 = {
    version: DOCUMENT_VERSION,
    layouts: { 'monster-trainer:starter-village': layout }
  };
  try {
    mkdirSync(userDataPath, { recursive: true });
    writeFileSync(tempPath, JSON.stringify(document), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(tempPath, filename);
    return { ok: true };
  } catch {
    try { unlinkSync(tempPath); } catch { /* no temp file was created or already renamed */ }
    return { ok: false, category: 'io' };
  }
}
