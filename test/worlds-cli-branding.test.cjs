'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const cli = path.join(root, 'tools/munder/munder');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });

test('top-level Worlds CLI help uses Worlds names for its commands and products', () => {
  const result = run('help');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /╭─+╮[\s\S]*◆ ISYCO WORLDS[\s\S]*╰─+╯/);
  assert.match(result.stdout, /Uso: worlds <comando>/);
  assert.match(result.stdout, /WORLD CONTROL/);
  assert.match(result.stdout, /TEAM & TOOLS/);
  assert.match(result.stdout, /WORLDS & CONNECTIONS/);
  assert.doesNotMatch(result.stdout, /\x1b\[/, 'non-TTY help stays plain for scripts and pipes');
  assert.match(result.stdout, /Worlds Panel/);
  assert.match(result.stdout, /World Link/);
  assert.doesNotMatch(result.stdout, /Munder Difflin|Munder Link|Munder Panel/);
});

test('the Panel preview resolves its visual assets when opened as a local file', () => {
  const page = fs.readFileSync(path.join(root, 'tools/munder/panel-app/index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'tools/munder/panel-app/panel.css'), 'utf8');
  assert.match(page, /href="\.\/panel\.css"/);
  assert.match(page, /src="\.\/panel\.js"/);
  assert.match(styles, /url\("\.\/font\.woff2"\)/);
});

test('link and GPT subcommand help use the Worlds command prefix', () => {
  const link = run('link', 'ayuda');
  assert.equal(link.status, 0);
  assert.match(link.stdout, /worlds link conectar/);
  assert.match(link.stdout, /Worlds Remote/);
  assert.doesNotMatch(link.stdout, /munder link|Munder Link|Munder Remote/);

  const gpt = run('gpt', 'ayuda');
  assert.equal(gpt.status, 0);
  assert.match(gpt.stdout, /worlds gpt perfil/);
  assert.doesNotMatch(gpt.stdout, /munder gpt|Munder/);
});

test('Reviver help is documented as a Worlds command and the CLI guide leads with worlds', () => {
  const reviver = run('reviver', 'ayuda');
  assert.equal(reviver.status, 0);
  assert.match(reviver.stdout, /worlds reviver/);
  assert.doesNotMatch(reviver.stdout, /Munder Difflin|Munder configurado/);

  const guide = fs.readFileSync(path.join(root, 'tools/munder/README.md'), 'utf8');
  assert.match(guide, /`worlds`/);
  assert.match(guide, /worlds start/);
  assert.match(guide, /alias histórico `munder`/);
});
