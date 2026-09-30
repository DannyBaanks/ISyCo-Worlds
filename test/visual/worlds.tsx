/** Browser-only visual fixture. No preload, network providers or real processes.
 * The production App and components render against explicit, inert IPC data. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/renderer/src/design/global.css';
import '../../src/renderer/src/design/worlds.css';
const params = new URLSearchParams(location.search);
localStorage.setItem('cth.language', params.get('lang') || 'es');
localStorage.setItem('cth.skipHivePickerOnce', '1');
localStorage.setItem('cth.theme', params.get('theme') || 'light');
const config = {
  onboardingComplete: true, harnessHome: null, registeredRepos: [], recentHives: [],
  defaultCommand: 'codex', autoMode: false, worldsEnabled: true,
  selectedWorld: 'monster-trainer', freeflowEnabled: false,
  terminalTheme: params.get('theme') || 'light', godName: 'Coordinador',
  webhookTriggers: [{ id: 'visual', enabled: false, name: 'Visual fixture', secret: '', mode: 'notify', schema: '{}', createdAt: 0 }],
  orgTrigger: { enabled: false, apiKey: '', mode: 'notify' },
  permissions: { allowRead: true }, scheduledMissions: []
};
let configChanged = () => {};
const api = {
  platform: 'linux', arch: 'x64',
  rosterReadSync: () => null, harnessHomeSync: () => null,
  getConfig: async () => config,
  onConfigChanged: (fn) => { configChanged = fn; return () => {}; },
  updateConfig: async (patch) => { Object.assign(config, patch); configChanged({...config}); return config; },
  listPtys: async () => [],
  hiveRegistry: async () => ({ agents: [] }),
  hiveTasks: async () => ({ tasks: [] }),
  hiveMemory: async () => '',
  hiveBoard: async () => '',
  listWorkers: async () => ({ workers: [], events: [] }),
  skillsCatalog: async () => ({ skills: [], source: 'fixture' }),
  worldProfiles: async () => ({ version: 1, profiles: {} }),
  getOrgTrigger: async () => config.orgTrigger,
  listWebhooks: async () => config.webhookTriggers,
  controlSnapshot: async () => ({ autoDeliveryPaused: false }),
  realtimeHasOpenAiKey: async () => false,
  updateCurrent: async () => ({ state: 'not-available' }),
  appInfo: async () => ({ version: '0.5.2-ISyCo.2', platform: 'linux', packaged: false }),
  modelCatalog: async () => null,
  heroPayload: async () => { throw new Error('fixture: no remote hero'); },
  kgStatus: async () => ({ docCount: 0 }),
  slackStatus: async () => ({ running: false }),
  webhooksStatus: async () => ({ running: false, endpoints: [] })
};
window.cth = new Proxy(api, { get(target, key) {
  if (key in target) return target[key];
  if (String(key).startsWith('on')) return () => () => {};
  return async () => [];
}}) as any;
const { default: i18n } = await import('../../src/renderer/src/i18n');
await i18n.changeLanguage(params.get('lang') || 'es');
document.documentElement.dataset.cthTheme = config.terminalTheme;
const { useStore } = await import('../../src/renderer/src/store/store');
const base = { character: 'michael', accent: 'mint', description: 'Fixture', project: '/workspace/a-project-with-a-very-long-name/and-a-long-path', cwd: '/fixture', tmuxTarget: '', status: 'idle', action: '', progress: 2, queue: [], logs: [], files: [] };
useStore.setState({
  agents: [
    { ...base, id: 'god', name: 'Coordinador', isGod: true },
    { ...base, id: 'flora', name: 'Flora', character: 'pam', accent: 'mint', status: 'working', action: 'Revisando el jardín de componentes' },
    { ...base, id: 'ember', name: 'Ember', character: 'dwight', accent: 'coral', status: 'blocked', note: 'Esperando tu revisión' }
  ] as any,
  selectedId: 'god', godStatus: 'ready', archivedAgents: [], fullscreenAgentId: null,
  sidebarWidth: Number(params.get('sidebar') || 420),
});
const { App } = await import('../../src/renderer/src/App');
const { OnboardingWizard } = await import('../../src/renderer/src/components/OnboardingWizard');
const { HivePicker } = await import('../../src/renderer/src/components/HivePicker');
createRoot(document.getElementById('root')!).render(params.get('view') === 'entry'
  ? <HivePicker config={{...config, harnessHome: '/workspace/isyco-worlds'}} onOpenCurrent={() => {}} />
  : params.get('view') === 'onboarding' ? <OnboardingWizard onComplete={() => {}} /> : <App />);
