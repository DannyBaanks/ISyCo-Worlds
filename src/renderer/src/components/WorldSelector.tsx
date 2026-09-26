import { useTranslation } from 'react-i18next';
import type { HarnessConfig } from '@/store/config';
import { WORLD_REGISTRY } from '@/worlds/worldRegistry';

/** Compact title-bar selector, intentionally absent while Worlds is disabled. */
export function WorldSelector({ config }: { config: HarnessConfig }) {
  const { t } = useTranslation();
  if (!config.worldsEnabled) return null;
  const selected = WORLD_REGISTRY.some((world) => world.id === config.selectedWorld)
    ? config.selectedWorld
    : 'office';
  return (
    <label className="cth-titlebar-nodrag" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 7, color: 'var(--cth-ink-500)' }}>
        {t('settings.general.worlds.selector')}
      </span>
      <select
        value={selected}
        onChange={(event) => { void window.cth.updateConfig({ selectedWorld: event.target.value as typeof selected }); }}
        aria-label={t('settings.general.worlds.selector')}
        style={{ height: 24, maxWidth: 142, background: 'var(--cth-paper-100)', border: '1px solid var(--cth-ink-300)', color: 'var(--cth-ink-900)', fontSize: 11 }}
      >
        {WORLD_REGISTRY.map((world) => (
          <option key={world.id} value={world.id}>{t(world.labelKey)}</option>
        ))}
      </select>
    </label>
  );
}
