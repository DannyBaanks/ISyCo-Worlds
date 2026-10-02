import { useTranslation } from 'react-i18next';
import { monsterRosterSheet } from '@/worlds/monster/monsterRosterSprites';
import type { IsycoRosterCharacter } from '@/worlds/monster/rosterCharacters';

/** Idle cell of a 5×2 sheet. The cell is square; the portrait box crops it. */
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
  const cell = height;

  return (
    <div
      role="img"
      aria-label={t(`worldCharacters.${character}`)}
      style={{ width, height, position: 'relative', overflow: 'hidden', flexShrink: 0 }}
    >
      <img
        src={monsterRosterSheet(character)}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          top: 0,
          left: (width - cell) / 2,
          width: cell * 5,
          height: cell * 2,
          maxWidth: 'none',
          objectFit: 'fill',
          imageRendering: 'pixelated',
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      />
    </div>
  );
}
