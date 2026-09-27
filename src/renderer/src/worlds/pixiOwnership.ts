/** A Pixi Application may finish initializing after React has unmounted it. */
const released = new WeakSet<object>();
let currentLease: Promise<void> = Promise.resolve();

/** Serialize Pixi initialization and ownership, including React effect remounts. */
export async function acquireWorldRendererLease(): Promise<() => boolean> {
  const previous = currentLease;
  let resolveLease!: () => void;
  currentLease = new Promise<void>((resolve) => { resolveLease = resolve; });
  await previous;
  let returned = false;
  return () => {
    if (returned) return false;
    returned = true;
    resolveLease();
    return true;
  };
}

/** Run a renderer's cleanup once even when async failure and unmount race. */
export function disposeWorldRendererOnce(renderer: object, cleanup: () => void): boolean {
  if (released.has(renderer)) return false;
  released.add(renderer);
  cleanup();
  return true;
}
