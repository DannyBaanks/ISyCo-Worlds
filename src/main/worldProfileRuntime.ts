import { randomUUID } from 'node:crypto';
import { access, cp, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export interface WorldRuntimeRoots {
  workspaceRoot: string;
  profileRoot: string;
}

export interface LegacyMigrationResult {
  status: 'not-needed' | 'copied' | 'already-migrated';
  copied: string[];
}

export interface WorldProfileRuntimeError extends Error {
  code: string;
  path?: string;
}

const LEGACY_ENTRIES = ['hive', 'palace', 'roster.json', 'roster-backups'] as const;
const MIGRATION_JOURNAL = '.legacy-migration.json';

function runtimeError(code: string, message: string, path?: string): WorldProfileRuntimeError {
  const error = new Error(message) as WorldProfileRuntimeError;
  error.name = 'WorldProfileRuntimeError';
  error.code = code;
  if (path) error.path = path;
  return error;
}

function profileIdIsSafe(profileId: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profileId);
}

export function resolveWorldRuntimeRoots(workspaceRoot: string, profileId: string): WorldRuntimeRoots {
  if (typeof profileId !== 'string' || !profileIdIsSafe(profileId)) {
    throw runtimeError('invalid-profile-id', 'World profile id is not a safe path component');
  }
  const workspace = resolve(workspaceRoot);
  const profile = resolve(workspace, '.munder', 'worlds', profileId);
  const rel = relative(workspace, profile);
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
    throw runtimeError('profile-root-escape', 'World profile root escapes its workspace', profile);
  }
  return { workspaceRoot: workspace, profileRoot: profile };
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function directoryEntriesWithoutSockets(path: string): Promise<string[]> {
  const names = await readdir(path);
  const entries: string[] = [];
  for (const name of names) {
    if (!(await lstat(join(path, name))).isSocket()) entries.push(name);
  }
  return entries;
}

async function sameTree(left: string, right: string): Promise<boolean> {
  if (!(await exists(left)) || !(await exists(right))) return false;
  const [a, b] = await Promise.all([stat(left), stat(right)]);
  if (a.isFile() !== b.isFile() || a.isDirectory() !== b.isDirectory()) return false;
  if (a.isFile()) {
    const [aBytes, bBytes] = await Promise.all([readFile(left), readFile(right)]);
    return aBytes.equals(bBytes);
  }
  if (!a.isDirectory()) return false;
  const [aNames, bNames] = await Promise.all([
    directoryEntriesWithoutSockets(left),
    directoryEntriesWithoutSockets(right)
  ]);
  if (aNames.length !== bNames.length || aNames.some((name) => !bNames.includes(name))) return false;
  for (const name of aNames) if (!(await sameTree(join(left, name), join(right, name)))) return false;
  return true;
}

function validateMigrationRoots(workspaceRoot: string, profileRoot: string): { workspace: string; profile: string } {
  const workspace = resolve(workspaceRoot);
  const profile = resolve(profileRoot);
  const rel = relative(workspace, profile);
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
    throw runtimeError('profile-root-escape', 'Migration destination must be nested in the workspace', profile);
  }
  const parts = rel.split(sep);
  if (parts.length !== 3 || parts[0] !== '.munder' || parts[1] !== 'worlds' || !profileIdIsSafe(parts[2])) {
    throw runtimeError('invalid-profile-root', 'Migration destination is not a recognized world profile root', profile);
  }
  return { workspace, profile };
}

/**
 * Copy Munder's legacy workspace-root state into one isolated profile. All
 * sources remain in place. Data is first staged, then checked for conflicts,
 * then promoted one entry at a time; reruns finish a partially promoted copy.
 */
export async function migrateLegacyMunderState(
  workspaceRoot: string,
  profileRoot: string
): Promise<LegacyMigrationResult> {
  const roots = validateMigrationRoots(workspaceRoot, profileRoot);
  const present: string[] = [];
  for (const name of LEGACY_ENTRIES) if (await exists(join(roots.workspace, name))) present.push(name);
  if (present.length === 0) return { status: 'not-needed', copied: [] };

  await mkdir(roots.profile, { recursive: true });
  const journalPath = join(roots.profile, MIGRATION_JOURNAL);
  try {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { version?: number; copied?: unknown };
    const recorded = Array.isArray(journal.copied) ? journal.copied as unknown[] : [];
    if (journal.version === 1 && present.every((name) => recorded.includes(name))) {
      const valid = await Promise.all(present.map((name) => sameTree(join(roots.workspace, name), join(roots.profile, name))));
      if (valid.every(Boolean)) return { status: 'already-migrated', copied: [] };
    }
  } catch { /* missing/corrupt journal: revalidate and resume from source */ }

  const staging = join(roots.profile, `.legacy-migration-${randomUUID()}`);
  await mkdir(staging, { recursive: true });
  try {
    for (const name of present) {
      await cp(join(roots.workspace, name), join(staging, name), {
        recursive: true,
        errorOnExist: true,
        force: false,
        filter: async (source) => !(await lstat(source)).isSocket()
      });
    }

    for (const name of present) {
      const source = join(roots.workspace, name);
      const target = join(roots.profile, name);
      if (await exists(target)) {
        if (!(await sameTree(source, target))) throw runtimeError('migration-conflict', `Refusing to replace conflicting profile data: ${name}`, target);
      }
    }

    const copied: string[] = [];
    for (const name of present) {
      const target = join(roots.profile, name);
      if (await exists(target)) continue;
      await rename(join(staging, name), target);
      copied.push(name);
    }

    // The manifest is the commit marker; never claim migration before every
    // promoted entry compares equal to its legacy source.
    for (const name of present) {
      if (!(await sameTree(join(roots.workspace, name), join(roots.profile, name)))) {
        throw runtimeError('migration-validation-failed', `Copied profile data did not validate: ${name}`, join(roots.profile, name));
      }
    }
    await writeFile(journalPath, `${JSON.stringify({ version: 1, copied: present }, null, 2)}\n`, { encoding: 'utf8', flag: 'w' });
    return { status: 'copied', copied };
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}

export const LEGACY_MUNDER_STATE_ENTRIES = LEGACY_ENTRIES;
