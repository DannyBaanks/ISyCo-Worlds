'use strict';

/**
 * Fixture for test/second-instance-clobber.test.cjs — a minimal Electron app
 * that mirrors the lifecycle shape of src/main/index.ts around the
 * single-instance lock:
 *
 *   1. requestSingleInstanceLock() at module top; the loser sets allowQuit
 *      and calls app.quit() — but, as in the real app, module evaluation does
 *      NOT stop there and Electron still fires ready during the graceful quit.
 *   2. app.whenReady() runs the "boot", which writes the control file — the
 *      same thing bootstrapHiveServices does to munder-control.json.
 *   3. app.on('will-quit') defers the exit once (the real app's bounded
 *      analytics flush), so the quit is graceful and the wrong boot has a
 *      window to clobber the file — exactly the live defect.
 *
 * SI_GUARDED=1 adds the guard under test (`if (!gotInstanceLock) return;` at
 * the top of the ready callback, mirroring the fix in index.ts); SI_GUARDED=0
 * is the pre-fix shape and must reproduce the clobber.
 *
 * Env in:  SI_CONTROL_FILE  file the boot writes (joint discovery file)
 *          SI_DATA_DIR      userData dir — shared by both instances, so the
 *                           second launch collides with the first one's lock
 *          SI_GUARDED       '1' to guard the boot on the lock, '0' to omit it
 */

const { app } = require('electron');
const fs = require('node:fs');

const controlFile = process.env.SI_CONTROL_FILE;
const guarded = process.env.SI_GUARDED === '1';
app.setPath('userData', process.env.SI_DATA_DIR);

let allowQuit = false;
const gotInstanceLock = app.requestSingleInstanceLock();
if (!gotInstanceLock) {
  allowQuit = true;
  app.quit();
}

app.on('before-quit', () => {
  if (allowQuit) return;
});

let deferred = false;
app.on('will-quit', (e) => {
  if (deferred) return;
  deferred = true;
  e.preventDefault();
  setTimeout(() => app.exit(0), 300);
});

process.on('SIGTERM', () => app.exit(0));

app.whenReady().then(async () => {
  if (guarded && !gotInstanceLock) return;

  // The boot's side effect: publish this process as the live control endpoint.
  // Synchronous by design — the pre-fix instance runs this during the quit.
  fs.writeFileSync(controlFile, JSON.stringify({ pid: process.pid, nonce: Date.now() }));
  console.log('CONTROL_WRITTEN pid=' + process.pid + ' lock=' + gotInstanceLock);
});
