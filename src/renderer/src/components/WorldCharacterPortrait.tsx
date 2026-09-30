import { useTranslation } from 'react-i18next';
import startersUrl from '@/assets/worlds/characters/isyco-monster-starters.png?url';
import professorRosterUrl from '@/assets/worlds/characters/isyco-professor-roster-sheet.png?url';
import type { IsycoRosterCharacter } from '@/worlds/monster/rosterCharacters';

const MONSTER_INDEX: Record<Exclude<IsycoRosterCharacter, 'professor'>, number> = {
  leaf: 0,
  fire: 1,
  water: 2
};

export function WorldCharacterPortrait({
  character,
  width = 44,
  height = 50
}: {
  character: IsycoRosterCharacter;
  width?: number;
  height?: number;
}) {
  const { t } = useTranslation();
  const isProfessor = character === 'professor';
  const divisions = isProfessor ? 5 : 3;
  const frame = height * 3 / divisions;
  const index = isProfessor ? 4 : MONSTER_INDEX[character];
  const left = width / 2 - frame * (index + 0.5);

  return (
    <div
      role="img"
      aria-label={t(`worldCharacters.${character}`)}
      style={{ width, height, position: 'relative', overflow: 'hidden', flexShrink: 0 }}
    >
      <img
        src={isProfessor ? professorRosterUrl : startersUrl}
        alt=""
        draggable={false}
        style={{
          position: 'absolute', top: 0, left,
          width: height * 3, height,
          maxWidth: 'none', objectFit: 'fill',
          imageRendering: 'pixelated', pointerEvents: 'none', userSelect: 'none'
        }}
      />
    </div>
  );
}
