import type { MonsterRosterCharacter } from './rosterCharacters';

export interface MonsterRosterSpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The generated three-creature sheet is an even row of 724px transparent cells. */
export const MONSTER_ROSTER_SPRITE_CELL_SIZE = 724;

const ROSTER_COLUMN: Record<MonsterRosterCharacter, number> = {
  leaf: 0,
  fire: 1,
  water: 2
};

export function monsterRosterSpriteFrame(character: MonsterRosterCharacter): MonsterRosterSpriteFrame {
  return {
    x: ROSTER_COLUMN[character] * MONSTER_ROSTER_SPRITE_CELL_SIZE,
    y: 0,
    width: MONSTER_ROSTER_SPRITE_CELL_SIZE,
    height: MONSTER_ROSTER_SPRITE_CELL_SIZE
  };
}
