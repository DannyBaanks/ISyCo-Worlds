'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const userData = process.env.ISYCO_SMOKE_USER_DATA;
if (!userData) process.exit(20);

try {
  const config = JSON.parse(fs.readFileSync(path.join(userData, 'config.json'), 'utf8'));
  if (config.onboardingComplete !== true || typeof config.harnessHome !== 'string' || !fs.existsSync(config.harnessHome)) {
    process.exit(21);
  }
} catch {
  process.exit(22);
}

const token = 'release-smoke-fixture-token';
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/salud' || req.headers.authorization !== `Bearer ${token}`) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    ok: true,
    service: 'munder-control',
    instance: { version: process.env.ISYCO_SMOKE_EXPECT_VERSION, pid: process.pid }
  }));
});

server.listen(0, '127.0.0.1', () => {
  fs.writeFileSync(path.join(userData, 'munder-control.json'), JSON.stringify({ port: server.address().port, token }));
});

function stop() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
