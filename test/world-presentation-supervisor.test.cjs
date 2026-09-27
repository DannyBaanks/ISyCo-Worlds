'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { WorldPresentationSupervisor } = loadTs('src/main/worldPresentationSupervisor.ts');
const projection = { agents: [{ id: 'atlas', name: 'Atlas', state: 'working', archived: false }], tasks: [] };

function fixture() {
  const hosts = [];
  const harnessCalls = [];
  const statuses = [];
  const supervisor = new WorldPresentationSupervisor({
    createHost: async (generation, emit) => {
      const host = {
        id: `visual-${generation}`,
        commands: [],
        destroyed: 0,
        send(command) { this.commands.push(command); },
        async destroy() { this.destroyed += 1; },
        emit
      };
      hosts.push(host);
      return host;
    },
    onStatus: (status) => statuses.push(status),
    onIntent: (intent) => harnessCalls.push(intent)
  });
  return { supervisor, hosts, harnessCalls, statuses };
}

test('restarting the visual host destroys only the old host and never invokes harness adapters', async () => {
  const { supervisor, hosts, harnessCalls } = fixture();
  await supervisor.start('office', projection);
  const first = hosts[0];
  first.emit({ type: 'ready', profileId: 'office', generation: 1 });
  assert.equal(supervisor.getStatus().phase, 'READY');

  await supervisor.restartVisual();
  assert.equal(first.destroyed, 1);
  assert.equal(hosts.length, 2);
  assert.equal(hosts[1].commands[0].type, 'bootstrap');
  assert.equal(hosts[1].commands[0].generation, 2);
  assert.equal(supervisor.getStatus().phase, 'BOOTSTRAPPING');
  assert.deepEqual(harnessCalls, []);
  assert.equal(first.emit({ type: 'ready', profileId: 'office', generation: 1 }), false, 'stale host event rejected');
});

test('projection updates stay in the current visual generation and intents are explicit', async () => {
  const { supervisor, hosts, harnessCalls } = fixture();
  await supervisor.start('monster-trainer', projection);
  hosts[0].emit({ type: 'ready', profileId: 'monster-trainer', generation: 1 });
  await supervisor.updateProjection({ agents: [], tasks: [] });
  assert.equal(hosts[0].commands.at(-1).type, 'update-projection');
  assert.equal(hosts[0].commands.at(-1).generation, 1);
  assert.equal(hosts[0].emit({ type: 'intent', profileId: 'monster-trainer', generation: 1, intent: { type: 'select-agent', agentId: 'atlas' } }), true);
  assert.deepEqual(harnessCalls, [{ type: 'select-agent', agentId: 'atlas' }]);
  assert.equal(hosts[0].emit({ type: 'intent', profileId: 'monster-trainer', generation: 0, intent: { type: 'select-agent', agentId: 'atlas' } }), false);
  assert.equal(harnessCalls.length, 1);
});

test('dispose is idempotent and emits no semantic runtime calls', async () => {
  const { supervisor, hosts, harnessCalls } = fixture();
  await supervisor.start('office', projection);
  await supervisor.dispose();
  await supervisor.dispose();
  assert.equal(hosts[0].destroyed, 1);
  assert.equal(supervisor.getStatus().phase, 'IDLE');
  assert.deepEqual(harnessCalls, []);
});

test('host creation failure becomes a structured recovery status without touching harness state', async () => {
  const supervisor = new WorldPresentationSupervisor({
    createHost: async () => { throw new Error('renderer unavailable'); },
    onStatus: () => {},
    onIntent: () => assert.fail('no intent expected')
  });
  await supervisor.start('office', projection);
  assert.equal(supervisor.getStatus().phase, 'RECOVERY');
  assert.equal(supervisor.getStatus().error.profileId, 'office');
  assert.equal(supervisor.getStatus().error.phase, 'BOOTSTRAPPING');
  assert.match(supervisor.getStatus().error.cause.message, /renderer unavailable/);
});

test('a runtime renderer failure enters Recovery and retires the failed host exactly once', async () => {
  const { supervisor, hosts } = fixture();
  await supervisor.start('office', projection);
  const host = hosts[0];
  assert.equal(host.emit({
    type: 'failed', profileId: 'office', generation: 1,
    error: { phase: 'MOUNTING', category: 'resource', cause: { name: 'Error', message: 'asset missing' } }
  }), true);
  await Promise.resolve();
  assert.equal(supervisor.getStatus().phase, 'RECOVERY');
  assert.equal(host.destroyed, 1);
  assert.equal(host.emit({ type: 'ready', profileId: 'office', generation: 1 }), false);
});

test('a renderer that crashes during async host bootstrap cannot be adopted or later report READY', async () => {
  let destroyed = 0;
  const supervisor = new WorldPresentationSupervisor({
    createHost: async () => ({ id: 'crashed-before-adoption', send() {}, isAlive: () => false, async destroy() { destroyed += 1; } }),
    onStatus: () => {},
    onIntent: () => {}
  });
  await supervisor.start('monster-trainer', projection);
  assert.equal(supervisor.getStatus().phase, 'RECOVERY');
  assert.equal(supervisor.getStatus().error.phase, 'BOOTSTRAPPING');
  assert.equal(destroyed, 1);
});
