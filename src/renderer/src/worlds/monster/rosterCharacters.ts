export const MONSTER_ROSTER_CHARACTERS = ['agua', 'fuego', 'electricidad', 'oscuridad', 'luz', 'aire'] as const;

export type MonsterRosterCharacter = (typeof MONSTER_ROSTER_CHARACTERS)[number];
export type IsycoRosterCharacter = MonsterRosterCharacter | 'professor';

/** Saved agents from the first three portraits still resolve to a real sheet. */
const LEGACY_ROSTER_CHARACTERS: Readonly<Record<string, MonsterRosterCharacter>> = {
  leaf: 'luz',
  fire: 'fuego',
  water: 'agua'
};

export const MONSTER_ROSTER_LABEL_KEYS: Record<MonsterRosterCharacter, string> = {
  agua: 'worldCharacters.agua',
  fuego: 'worldCharacters.fuego',
  electricidad: 'worldCharacters.electricidad',
  oscuridad: 'worldCharacters.oscuridad',
  luz: 'worldCharacters.luz',
  aire: 'worldCharacters.aire'
};

export function isMonsterRosterCharacter(value: unknown): value is MonsterRosterCharacter {
  return typeof value === 'string'
    && (MONSTER_ROSTER_CHARACTERS as readonly string[]).includes(value);
}

export function canonicalMonsterCharacter(value: unknown): MonsterRosterCharacter | undefined {
  if (isMonsterRosterCharacter(value)) return value;
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_ROSTER_CHARACTERS, value)) {
    return LEGACY_ROSTER_CHARACTERS[value];
  }
  return undefined;
}

/** Keep legacy agents visually assigned when they first enter Monster Village. */
export function monsterCharacterForAgent(agentId: string): MonsterRosterCharacter {
  let hash = 0x811c9dc5;
  for (let index = 0; index < agentId.length; index += 1) {
    hash ^= agentId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return MONSTER_ROSTER_CHARACTERS[hash % MONSTER_ROSTER_CHARACTERS.length];
}

export function resolveMonsterCharacter(value: unknown, agentId: string): MonsterRosterCharacter {
  return canonicalMonsterCharacter(value) ?? monsterCharacterForAgent(agentId);
}
