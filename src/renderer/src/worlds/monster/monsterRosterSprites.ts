import aguaUrl from '../../assets/worlds/characters/roster/agua.png?url';
import fuegoUrl from '../../assets/worlds/characters/roster/fuego.png?url';
import electricidadUrl from '../../assets/worlds/characters/roster/electricidad.png?url';
import oscuridadUrl from '../../assets/worlds/characters/roster/oscuridad.png?url';
import luzUrl from '../../assets/worlds/characters/roster/luz.png?url';
import aireUrl from '../../assets/worlds/characters/roster/aire.png?url';
import profesorUrl from '../../assets/worlds/characters/roster/profesor.png?url';
import type { IsycoRosterCharacter, MonsterRosterCharacter } from './rosterCharacters';

/** Each approved sheet is 1980×792: five columns by two rows of 396×396 cells. */
export const MONSTER_ROSTER_CELL = 396;
export const MONSTER_ROSTER_COLUMNS = 5;
export const MONSTER_ROSTER_ROWS = 2;
/**
 * 396 / 12. An integer divisor keeps nearest-neighbor pixels crisp, and 33px
 * is just over two 16px tiles: shorter than the 80px houses, small on the 64×48 map.
 */
export const MONSTER_ACTOR_PX = MONSTER_ROSTER_CELL / 12;

export const MONSTER_ROSTER_URLS: Record<MonsterRosterCharacter | 'professor', string> = {
  agua: aguaUrl,
  fuego: fuegoUrl,
  electricidad: electricidadUrl,
  oscuridad: oscuridadUrl,
  luz: luzUrl,
  aire: aireUrl,
  professor: profesorUrl
};

const ACTION_ORIGIN = {
  idle: 0,
  walk: 2,
  work: 4,
  waiting: 6,
  blocked: 8
} as const;

export type MonsterRosterAction = keyof typeof ACTION_ORIGIN;

export interface MonsterRosterSpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Frame order matches the approved sheets: idle, walk, work, wait, blocked, each with an A/B pose. */
export function monsterRosterFrame(action: MonsterRosterAction, frame: number): MonsterRosterSpriteFrame {
  const index = ACTION_ORIGIN[action] + (frame & 1);
  return {
    x: (index % MONSTER_ROSTER_COLUMNS) * MONSTER_ROSTER_CELL,
    y: Math.floor(index / MONSTER_ROSTER_COLUMNS) * MONSTER_ROSTER_CELL,
    width: MONSTER_ROSTER_CELL,
    height: MONSTER_ROSTER_CELL
  };
}

export function monsterRosterSheet(character: IsycoRosterCharacter): string {
  return MONSTER_ROSTER_URLS[character];
}
