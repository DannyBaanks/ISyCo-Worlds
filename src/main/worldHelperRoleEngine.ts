import agentContract from './agents/AGENT.md?raw';
import gusRoleDocument from './agents/gus.md?raw';

export interface WorldHelperRoleCapabilities {
  observeWorld: boolean;
  proposeWorkforce: boolean;
  suggestWorld: boolean;
  launchWorker: boolean;
  executeShell: boolean;
  modifyWorldConfig: boolean;
}

export interface WorldHelperRole {
  id: 'gus';
  displayName: 'GUS';
  mode: 'primary';
  capabilities: WorldHelperRoleCapabilities;
  instructions: string;
}

const TOOL_FIELDS: Readonly<Record<keyof WorldHelperRoleCapabilities, string>> = {
  observeWorld: 'observe-world',
  proposeWorkforce: 'propose-workforce',
  suggestWorld: 'suggest-world',
  launchWorker: 'launch-worker',
  executeShell: 'execute-shell',
  modifyWorldConfig: 'modify-world-config'
};

function splitDocument(source: string): { metadata: string; body: string } {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
  if (!match) throw new Error('invalid GUS role document: frontmatter required');
  return { metadata: match[1], body: match[2].trim() };
}

function stringField(metadata: string, key: string): string | undefined {
  return metadata.match(new RegExp(`^${key}:\\s*([^\\r\\n]+)\\s*$`, 'm'))?.[1]?.trim();
}

function booleanTool(metadata: string, tool: string): boolean | undefined {
  const match = metadata.match(new RegExp(`^\\s{2}${tool}:\\s*(true|false)\\s*$`, 'm'));
  return match ? match[1] === 'true' : undefined;
}

export function resolveGusRole(): WorldHelperRole {
  const { metadata, body } = splitDocument(gusRoleDocument);
  if (stringField(metadata, 'id') !== 'gus' || stringField(metadata, 'name') !== 'GUS'
    || stringField(metadata, 'mode') !== 'primary') {
    throw new Error('invalid GUS role identity');
  }
  const capabilityValues = Object.fromEntries(
    Object.entries(TOOL_FIELDS).map(([field, tool]) => [field, booleanTool(metadata, tool)])
  ) as Record<keyof WorldHelperRoleCapabilities, boolean | undefined>;
  if (Object.values(capabilityValues).some((value) => value === undefined)) {
    throw new Error('invalid GUS role tool permissions');
  }
  const capabilities = capabilityValues as unknown as WorldHelperRoleCapabilities;
  if (!capabilities.observeWorld || !capabilities.proposeWorkforce || !capabilities.suggestWorld
    || capabilities.launchWorker || capabilities.executeShell || capabilities.modifyWorldConfig) {
    throw new Error('GUS role exceeds its approved least-privilege policy');
  }
  return { id: 'gus', displayName: 'GUS', mode: 'primary', capabilities, instructions: body };
}

export function buildGusSystemPrompt(context: {
  world: string;
  availableRoles: readonly string[];
  installedProviders: readonly string[];
}): string {
  const role = resolveGusRole();
  const world = context.world === 'office' ? 'Office' : context.world === 'monster-trainer' ? 'Monster Trainer' : 'unknown';
  const safeRoles = context.availableRoles.map((value) => value.slice(0, 48));
  const safeProviders = context.installedProviders.map((value) => value.slice(0, 48));
  const granted = Object.entries(role.capabilities).filter(([, allowed]) => allowed).map(([id]) => id);
  return [
    agentContract.trim(),
    role.instructions,
    `## Live role context\nCurrent world: ${world}.\nCapabilities granted: ${granted.join(', ')}.\nAvailable worker roles: ${JSON.stringify(safeRoles)}.\nInstalled worker providers: ${JSON.stringify(safeProviders)}.`,
    '## Output protocol\nReturn only valid JSON with exactly `reply`, optional `worldSuggestion`, and `workers`. `reply` must be concise and human-readable, normally Spanish when the user writes Spanish. `workers` must contain at most five objects with exactly `name`, `provider`, `role`, and `purpose`; use only the live allowlists above. Use an empty array when no safe, useful proposal fits. A world suggestion may be only `office` or `monster-trainer` and is advice, never a switch. Proposals require explicit human approval before the app can launch anything.'
  ].join('\n\n');
}
