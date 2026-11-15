/** Monster Village exactly as the app loads it: the real scene entry
 * (src/renderer/src/worldHost.tsx) behind a mocked presentation bridge. It
 * shares no stylesheet or i18n setup with the shell fixture, by design. */
(window as any).worldPresentation = { onCommand: (fn: any) => { setTimeout(() => fn({ type: 'bootstrap', profileId: 'monster-trainer', generation: 1, projection: {
  agents: [{ id: 'god', name: 'Coordinador', state: 'idle', archived: false, isGod: true }, { id: 'flora', name: 'Flora', state: 'working', archived: false, monsterCharacter: 'agua' }, { id: 'ember', name: 'Ember', state: 'blocked', archived: false, monsterCharacter: 'fuego' }],
  tasks: [{ id: 't1', title: 'Pulir la pantalla de inicio', assignee: 'flora', status: 'doing', awaitsHuman: false }, { id: 't2', title: 'Revisar contraste del modo oscuro', assignee: 'ember', status: 'blocked', awaitsHuman: true }, { id: 't3', title: 'Escribir pruebas del selector de mundo', assignee: null, status: 'todo', awaitsHuman: false }], activity: [], visualIdentities: {} } }), 50); return () => {}; }, emit: () => {} };
await import('../../src/renderer/src/worldHost');
