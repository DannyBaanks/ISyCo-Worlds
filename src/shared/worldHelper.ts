/** Shared, renderer-safe contracts and provider metadata for GUS. */
import { isAgentProvider } from './agentProvider';
import { isWorldId, type WorldId } from './worlds';

export type WorldHelperProviderId = 'nvidia-nim' | 'openai' | 'anthropic';
export type WorldHelperLifecycle = 'STOPPED' | 'STARTING' | 'READY' | 'BUSY' | 'DEGRADED' | 'ERROR' | 'STOPPING';
export type WorldHelperSeverity = 'informational' | 'important' | 'requires_action';
export type WorldHelperStreamEvent =
  | { requestId: string; type: 'delta'; text: string }
  | { requestId: string; type: 'failed'; category: 'invalid-key' | 'offline' | 'quota' | 'invalid-response' | 'unavailable' }
  | { requestId: string; type: 'complete' };

export interface WorldHelperProviderMetadata {
  id: WorldHelperProviderId;
  displayName: string;
  apiKeyRequired: true;
  apiKeyHelpUrl: string;
  models: readonly { id: string; label: string }[];
  recommended?: boolean;
  availabilityNote?: string;
}

const PROVIDERS: readonly WorldHelperProviderMetadata[] = [
  {
    id: 'nvidia-nim', displayName: 'NVIDIA NIM', apiKeyRequired: true,
    apiKeyHelpUrl: 'https://build.nvidia.com/settings/api-keys',
    models: [{ id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', label: 'Nemotron 3 Nano Omni' }],
    recommended: true, availabilityNote: 'Free access may be available.'
  },
  {
    id: 'openai', displayName: 'OpenAI', apiKeyRequired: true,
    apiKeyHelpUrl: 'https://platform.openai.com/settings/organization/api-keys',
    models: [{ id: 'gpt-5-mini', label: 'GPT-5 mini' }]
  },
  {
    id: 'anthropic', displayName: 'Anthropic', apiKeyRequired: true,
    apiKeyHelpUrl: 'https://platform.claude.com/settings/keys',
    models: [{ id: 'claude-haiku-4-5', label: 'Claude Haiku' }]
  }
];

export function worldHelperProviders(): WorldHelperProviderMetadata[] {
  return PROVIDERS.map((provider) => ({ ...provider, models: provider.models.map((model) => ({ ...model })) }));
}

export function worldHelperProvider(id: unknown): WorldHelperProviderMetadata | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export interface ProposedWorker {
  name: string;
  provider: string;
  role: string;
  purpose: string;
}

export interface WorldHelperProposal {
  reply: string;
  workers: ProposedWorker[];
  /** Advisory only; the user changes the active world through Worlds. */
  worldSuggestion?: WorldId;
}
const MAX_REPLY = 1200;
const MAX_NAME = 48;
const MAX_PURPOSE = 300;

export function parseWorldHelperProposal(raw: unknown): { ok: true; value: WorldHelperProposal } | { ok: false; reason: 'invalid-json' | 'invalid-shape' | 'unknown-provider' | 'too-many-workers' } {
  let value: unknown;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return { ok: false, reason: 'invalid-json' }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, reason: 'invalid-shape' };
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== 'reply' && key !== 'workers' && key !== 'worldSuggestion')) return { ok: false, reason: 'invalid-shape' };
  if (typeof record.reply !== 'string' || !Array.isArray(record.workers) || record.reply.length > MAX_REPLY || record.workers.length > 5) {
    return { ok: false, reason: Array.isArray(record.workers) && record.workers.length > 5 ? 'too-many-workers' : 'invalid-shape' };
  }
  if (record.worldSuggestion !== undefined && !isWorldId(record.worldSuggestion)) return { ok: false, reason: 'invalid-shape' };
  const workers: ProposedWorker[] = [];
  const names = new Set<string>();
  for (const candidate of record.workers) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return { ok: false, reason: 'invalid-shape' };
    const worker = candidate as Record<string, unknown>;
    if (Object.keys(worker).some((key) => !['name', 'provider', 'role', 'purpose'].includes(key))) return { ok: false, reason: 'invalid-shape' };
    if (!isAgentProvider(worker.provider)) return { ok: false, reason: 'unknown-provider' };
    if (typeof worker.name !== 'string' || !worker.name.trim() || worker.name.length > MAX_NAME
      || typeof worker.role !== 'string' || !worker.role.trim() || worker.role.length > MAX_NAME
      || typeof worker.purpose !== 'string' || !worker.purpose.trim() || worker.purpose.length > MAX_PURPOSE) {
      return { ok: false, reason: 'invalid-shape' };
    }
    const normalizedName = worker.name.trim().toLocaleLowerCase();
    if (names.has(normalizedName)) return { ok: false, reason: 'invalid-shape' };
    names.add(normalizedName);
    workers.push({ name: worker.name.trim(), provider: worker.provider, role: worker.role.trim(), purpose: worker.purpose.trim() });
  }
  return { ok: true, value: { reply: record.reply.trim(), workers, ...(record.worldSuggestion ? { worldSuggestion: record.worldSuggestion } : {}) } };
}

/** Immutable by policy: provider output can never acquire execution authority. */
export const WORLD_HELPER_AUTHORITY_POLICY = Object.freeze({
  modelMayLaunchWorkers: false,
  approvalRequired: true,
  modelMayChooseCommand: false,
  modelMayChooseWorkspace: false,
  modelMayGrantCapabilities: false
});

export interface WorldHelperNotice {
  id: string;
  severity: WorldHelperSeverity;
  kind: 'worker-started' | 'worker-finished' | 'worker-blocked' | 'worker-error' | 'approval-requested' | 'task-finished' | 'task-blocked';
  workerId?: string;
  taskId?: string;
  title: string;
  createdAt: number;
}

export interface WorldHelperSafeSnapshot {
  lifecycle: WorldHelperLifecycle;
  enabled: boolean;
  configured: boolean;
  onboardingComplete?: boolean;
  setupDismissed?: boolean;
  provider: WorldHelperProviderId | null;
  model: string | null;
  errorCategory?: 'invalid-key' | 'offline' | 'quota' | 'invalid-response' | 'invalid-config' | 'unavailable';
  reply?: string;
  transcript?: Array<{ role: 'user' | 'assistant'; text: string; at: number }>;
  notices: WorldHelperNotice[];
  pendingProposal?: { id: string; reply: string; workers: ProposedWorker[]; worldSuggestion?: WorldId; workspace?: string };
}
