'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../package.json');
const lock = require('../package-lock.json');

test('the shared ip-address resolution pins the patched release with registry integrity', () => {
  const entry = lock.packages['node_modules/ip-address'];
  assert.equal(manifest.overrides['ip-address'], '10.7.2');
  assert.equal(entry.version, manifest.overrides['ip-address']);
  assert.equal(entry.resolved, 'https://registry.npmjs.org/ip-address/-/ip-address-10.7.2.tgz');
  assert.equal(entry.integrity, 'sha512-7H/2gFSIitxc0hG3nOI1glS8QLo/EHBFFLk8vEUjXY/xu0AdL8jZ9U1IzO2PUm0d2D/ofQcAifb0g6OBkt8U7w==');
  for (const [name, pkg] of Object.entries(lock.packages)) {
    if (name.endsWith('/ip-address')) assert.equal(pkg.version, entry.version, `unpatched nested resolution: ${name}`);
  }
});
