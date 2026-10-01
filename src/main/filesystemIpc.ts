import { homedir } from 'node:os';
import { isAbsolute, parse, resolve } from 'node:path';
import { listDir, readFileText, readFileBinary, writeFileText, safeResolve } from './fs';

export interface FilesystemIpcDependencies<Event> {
  isTrustedSender(event: Event): boolean;
  workspaceRoots(): readonly string[];
}

/** Ignore fragments, but never accept another document, origin or frame. */
export function isWorkspaceDocument(actual: string, expected: string): boolean {
  try {
    const a = new URL(actual), b = new URL(expected);
    a.hash = ''; b.hash = '';
    return a.href === b.href;
  } catch { return false; }
}

function isNarrowRoot(root: string): boolean {
  if (!root || !isAbsolute(root) || root.includes('\0') || root.length > 4096) return false;
  const abs = resolve(root);
  return abs !== parse(abs).root && abs !== resolve(homedir());
}

/** Authorize the root against main-owned workspaces BEFORE the ordinary path guard.
 * A renderer-supplied root is a selector, not a grant. Filesystem/whole-home roots
 * are deliberately not grants, even if stale config or agent metadata contains one.
 */
export function createFilesystemIpc<Event>(deps: FilesystemIpcDependencies<Event>) {
  async function authorize(event: Event, root: unknown): Promise<string | null> {
    if (!deps.isTrustedSender(event) || typeof root !== 'string' || !isNarrowRoot(root)) return null;
    try {
      const requestedRoot = await safeResolve(root, root);
      if (!requestedRoot || !isNarrowRoot(requestedRoot)) return null;
      for (const workspace of deps.workspaceRoots()) {
        if (typeof workspace !== 'string' || !isNarrowRoot(workspace)) continue;
        const canonicalRoot = await safeResolve(workspace, workspace);
        if (!canonicalRoot || !isNarrowRoot(canonicalRoot)) continue;
        const selected = await safeResolve(canonicalRoot, requestedRoot);
        if (selected && isNarrowRoot(selected)) return selected;
      }
    } catch { /* Unavailable registry or filesystem is not an authorization. */ }
    return null;
  }

  function reader<T>(operation: (root: string, rel: string) => Promise<T>) {
    return async (event: Event, root: unknown, rel: unknown) => {
      if (typeof rel !== 'string') return { ok: false as const, error: 'invalid args' };
      const authorized = await authorize(event, root);
      if (!authorized) return { ok: false as const, error: 'workspace access denied' };
      return operation(authorized, rel);
    };
  }

  return {
    listDir: reader(listDir),
    readFile: reader(readFileText),
    readBinary: reader(readFileBinary),
    async writeFile(event: Event, root: unknown, rel: unknown, content: unknown) {
      if (typeof rel !== 'string' || typeof content !== 'string') return { ok: false as const, error: 'invalid args' };
      const authorized = await authorize(event, root);
      if (!authorized) return { ok: false as const, error: 'workspace access denied' };
      return writeFileText(authorized, rel, content);
    }
  };
}
