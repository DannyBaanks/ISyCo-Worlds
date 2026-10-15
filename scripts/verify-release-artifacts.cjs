#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const platform = process.argv[2];
const expectedByPlatform = {
  mac: [
    'mac-universal.dmg',
    'mac-universal.zip',
  ],
  win: [
    'win-x64-setup.exe',
    'win-x64-portable.exe',
  ],
  linux: [
    'linux-x86_64.AppImage',
    'linux-amd64.deb',
  ],
};

if (!Object.hasOwn(expectedByPlatform, platform)) {
  console.error(`usage: node scripts/verify-release-artifacts.cjs <mac|win|linux>`);
  process.exit(2);
}

const version = require('../package.json').version;
const dist = path.join(__dirname, '..', 'dist');
const missing = [];

for (const suffix of expectedByPlatform[platform]) {
  const name = `ISyCo-Worlds-${version}-${suffix}`;
  const artifact = path.join(dist, name);
  if (!fs.existsSync(artifact) || !fs.statSync(artifact).isFile() || fs.statSync(artifact).size === 0) {
    missing.push(name);
    continue;
  }
  console.log(`✓ ${name} (${fs.statSync(artifact).size} bytes)`);
}

if (missing.length) {
  console.error(`Missing release installer(s) for ${platform}: ${missing.join(', ')}`);
  process.exit(1);
}
