export const MONSTER_ROSTER_CHARACTERS = ['leaf', 'fire', 'water'] as const;

export type MonsterRosterCharacter = (typeof MONSTER_ROSTER_CHARACTERS)[number];
export type IsycoRosterCharacter = MonsterRosterCharacter | 'professor';

export const MONSTER_ROSTER_LABEL_KEYS: Record<MonsterRosterCharacter, string> = {
  leaf: 'worldCharacters.leaf',
  fire: 'worldCharacters.fire',
  water: 'worldCharacters.water'
};

export function isMonsterRosterCharacter(value: unknown): value is MonsterRosterCharacter {
  return typeof value === 'string'
    && (MONSTER_ROSTER_CHARACTERS as readonly string[]).includes(value);
}

/** Keep legacy agents visually assigned when they first enter ISyCo World. */
export function monsterCharacterForAgent(agentId: string): MonsterRosterCharacter {
  let hash = 0x811c9dc5;
  for (let index = 0; index < agentId.length; index += 1) {
    hash ^= agentId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return MONSTER_ROSTER_CHARACTERS[hash % MONSTER_ROSTER_CHARACTERS.length];
}

export function resolveMonsterCharacter(value: unknown, agentId: string): MonsterRosterCharacter {
  return isMonsterRosterCharacter(value) ? value : monsterCharacterForAgent(agentId);
}
