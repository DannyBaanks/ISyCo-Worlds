'use strict';

const path = require('node:path');
const { app, BrowserWindow, WebContentsView } = require('electron');

const FIXTURE_DIR = __dirname;
const TIMEOUT_MS = 15_000;

function timeout(label) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), TIMEOUT_MS));
}

async function createVisual(primary, generation) {
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      partition: `world-presentation-witness-${generation}`
    }
  });
  primary.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: 640, height: 360 });
  await view.webContents.loadFile(path.join(FIXTURE_DIR, 'renderer.html'));
  return view;
}

async function closeVisual(primary, view) {
  primary.contentView.removeChildView(view);
  const destroyed = view.webContents.isDestroyed()
    ? Promise.resolve()
    : new Promise((resolve) => view.webContents.once('destroyed', resolve));
  if (!view.webContents.isDestroyed()) view.webContents.close();
  await Promise.race([destroyed, timeout('visual WebContents disposal')]);
}

async function crashVisual(view) {
  const gone = new Promise((resolve) => view.webContents.once('render-process-gone', (_event, details) => resolve(details)));
  view.webContents.forcefullyCrashRenderer();
  return Promise.race([gone, timeout('visual renderer crash event')]);
}

async function runWitness() {
  const primary = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  await primary.loadURL('data:text/html,<title>Primary GUI</title><main>primary gui</main>');
  const primaryPid = primary.webContents.getOSProcessId();
  const semanticSession = Object.freeze({
    profileId: 'monster-trainer',
    sessionId: 'session-stays-with-primary',
    agentIds: Object.freeze(['atlas', 'birch']),
    taskIds: Object.freeze(['task-1', 'task-2'])
  });
  const sessionBefore = JSON.stringify(semanticSession);

  const visualPids = [];
  const visualContents = [];
  let visualCrashes = 0;
  let current = null;
  for (let generation = 1; generation <= 4; generation += 1) {
    if (current) {
      const details = await crashVisual(current);
      if (!details || !details.reason) throw new Error('visual renderer crash did not report a reason');
      visualCrashes += 1;
      if (primary.isDestroyed() || primary.webContents.isDestroyed()) throw new Error('visual renderer crash destroyed the primary GUI');
      if (JSON.stringify(semanticSession) !== sessionBefore) throw new Error('visual renderer crash changed primary-owned semantic session state');
      await closeVisual(primary, current);
    }
    current = await createVisual(primary, generation);
    const visualPid = current.webContents.getOSProcessId();
    if (visualPid === primaryPid) throw new Error(`visual generation ${generation} shares the primary GUI renderer PID`);
    visualPids.push(visualPid);
    visualContents.push(current.webContents);
    if (primary.isDestroyed() || primary.webContents.isDestroyed()) throw new Error('closing visual host destroyed the primary GUI');
    if (primary.webContents.getOSProcessId() !== primaryPid) throw new Error('primary GUI renderer PID changed during visual restart');
    if (JSON.stringify(semanticSession) !== sessionBefore) throw new Error('visual restart changed primary-owned semantic session state');
  }

  const witness = {
    marker: 'WORLD_PRESENTATION_PID_WITNESS',
    primaryPid,
    firstVisualPid: visualPids[0],
    restartedVisualPid: visualPids.at(-1),
    visualPids,
    hostGenerations: visualPids.length,
    visualCrashes,
    allRetiredWebContentsDestroyed: visualContents.slice(0, -1).every((contents) => contents.isDestroyed()),
    semanticSessionStable: JSON.stringify(semanticSession) === sessionBefore,
    distinctFromPrimary: visualPids.every((pid) => pid > 0 && pid !== primaryPid),
    primaryPidStable: primary.webContents.getOSProcessId() === primaryPid,
    primaryAliveAfterVisualRestart: !primary.isDestroyed() && !primary.webContents.isDestroyed(),
    visualGenerationRecreated: current !== null && !current.webContents.isDestroyed()
  };
  console.log(JSON.stringify(witness));
  await closeVisual(primary, current);
  primary.close();
  app.quit();
  return witness;
}

app.whenReady().then(runWitness).catch((error) => {
  console.error(error?.stack || error);
  app.exit(1);
});
