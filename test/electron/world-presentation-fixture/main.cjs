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

async function runWitness() {
  const primary = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  await primary.loadURL('data:text/html,<title>Primary GUI</title><main>primary gui</main>');
  const primaryPid = primary.webContents.getOSProcessId();

  const first = await createVisual(primary, 1);
  const firstVisualPid = first.webContents.getOSProcessId();
  if (firstVisualPid === primaryPid) throw new Error('candidate visual WebContents shares the primary GUI renderer PID');

  await closeVisual(primary, first);
  if (primary.isDestroyed() || primary.webContents.isDestroyed()) throw new Error('closing visual host destroyed the primary GUI');
  const restarted = await createVisual(primary, 2);
  const restartedVisualPid = restarted.webContents.getOSProcessId();
  if (restartedVisualPid === primaryPid) throw new Error('recreated visual WebContents shares the primary GUI renderer PID');
  if (primary.webContents.getOSProcessId() !== primaryPid) throw new Error('primary GUI renderer PID changed during visual restart');

  const witness = {
    marker: 'WORLD_PRESENTATION_PID_WITNESS',
    primaryPid,
    firstVisualPid,
    restartedVisualPid,
    distinctFromPrimary: firstVisualPid !== primaryPid && restartedVisualPid !== primaryPid,
    primaryPidStable: primary.webContents.getOSProcessId() === primaryPid,
    primaryAliveAfterVisualRestart: !primary.isDestroyed() && !primary.webContents.isDestroyed(),
    visualGenerationRecreated: !restarted.webContents.isDestroyed()
  };
  console.log(JSON.stringify(witness));
  await closeVisual(primary, restarted);
  primary.close();
  app.quit();
  return witness;
}

app.whenReady().then(runWitness).catch((error) => {
  console.error(error?.stack || error);
  app.exit(1);
});
