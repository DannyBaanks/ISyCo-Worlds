'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const loadTs = require('./load-ts.cjs');
const { createFilesystemIpc, isWorkspaceDocument } = loadTs('src/main/filesystemIpc.ts');
const workspace = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(workspace, 'src/main/index.ts'), 'utf8');

function handlers(roots = [workspace], trusted = true) {
  return createFilesystemIpc({ isTrustedSender: (event) => trusted && event === 'main', workspaceRoots: () => roots });
}

test('all four file IPC channels bind to the common authorization gate', () => {
  for (const method of ['listDir', 'readFile', 'readBinary', 'writeFile']) {
    assert.ok(source.includes(`ipcMain.handle('fs:${method}', filesystemIpc.${method})`));
  }
  assert.match(source, /event\.senderFrame !== event\.sender\.mainFrame/);
  assert.match(source, /win\.webContents === event\.sender/);
});

test('arbitrary roots, ancestors and broad configured roots are rejected for every operation', async () => {
  for (const root of [path.parse(workspace).root, os.homedir(), path.dirname(workspace), os.tmpdir()]) {
    const ipc = handlers([workspace, path.parse(workspace).root, os.homedir()]);
    for (const method of ['listDir', 'readFile', 'readBinary']) {
      assert.equal((await ipc[method]('main', root, 'anything')).ok, false);
    }
    assert.equal((await ipc.writeFile('main', root, 'must-not-be-created', 'no')).ok, false);
  }
});

test('unowned senders are denied before even consulting the workspace registry', async () => {
  const ipc = createFilesystemIpc({ isTrustedSender: () => false, workspaceRoots: () => { throw new Error('must not run'); } });
  for (const method of ['listDir', 'readFile', 'readBinary']) {
    assert.equal((await ipc[method]('overlay', workspace, 'package.json')).error, 'workspace access denied');
  }
  assert.equal((await ipc.writeFile('overlay', workspace, 'package.json', 'no')).error, 'workspace access denied');
});

test('registered roots and their real descendants retain ordinary reads and path confinement', async () => {
  const ipc = handlers();
  assert.equal((await ipc.readFile('main', workspace, 'package.json')).ok, true);
  assert.equal((await ipc.readFile('main', path.join(workspace, 'src/main'), 'fs.ts')).ok, true);
  assert.equal((await ipc.listDir('main', workspace, 'src')).ok, true);
  assert.equal((await ipc.readBinary('main', workspace, 'package.json')).ok, true);
  assert.equal((await ipc.readFile('main', workspace, '../outside.txt')).ok, false);
});

test('registry changes revoke access rather than retaining a stale root grant', async () => {
  let roots = [workspace];
  const ipc = createFilesystemIpc({ isTrustedSender: () => true, workspaceRoots: () => roots });
  assert.equal((await ipc.readFile('main', workspace, 'package.json')).ok, true);
  roots = [];
  assert.equal((await ipc.readFile('main', workspace, 'package.json')).ok, false);
});

test('document identity allows fragments, not another page, origin or malformed URL', () => {
  for (const base of ['http://localhost:5173/', 'file:///app/renderer/index.html']) {
    assert.equal(isWorkspaceDocument(`${base}#ide`, base), true);
    assert.equal(isWorkspaceDocument(`${base}?other=1`, base), false);
    assert.equal(isWorkspaceDocument('https://attacker.invalid/', base), false);
    assert.equal(isWorkspaceDocument('not a URL', base), false);
  }
  assert.equal(isWorkspaceDocument('file:///app/renderer/world-helper-overlay.html', 'file:///app/renderer/index.html'), false);
});
