import { useTranslation } from 'react-i18next';
import type { HarnessConfig } from '@/store/config';
import { PixelButton } from '@/components/PixelButton';
import { PixelPanel } from '@/components/PixelPanel';
import { WorldHost } from './WorldHost';
import { WORLD_REGISTRY } from './worldRegistry';

/**
 * Dedicated visual-world surface. It owns visual selection and the one
 * alternative-world host, while the office's agent/task truth stays in App.
 */
export function WorldsView({
  config,
  onReturnToOffice
}: {
  config: HarnessConfig;
  onReturnToOffice: () => void;
}) {
  const { t } = useTranslation();
  const worlds = WORLD_REGISTRY.filter((world) => world.id !== 'office');
  const selectedWorld = worlds.some((world) => world.id === config.selectedWorld)
    ? config.selectedWorld
    : undefined;

  return (
    <section
      aria-label={t('settings.general.worlds.title')}
      style={{ position: 'absolute', inset: 0, overflow: 'auto', background: 'var(--cth-paper-100)' }}
    >
      <div style={{ minHeight: '100%', padding: 16, display: 'grid', gridTemplateColumns: 'minmax(250px, 320px) minmax(0, 1fr)', gap: 16 }}>
        <PixelPanel variant="default" noPadding style={{ alignSelf: 'start' }}>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <header>
              <h1 style={{ margin: 0, fontFamily: 'var(--cth-font-display)', fontSize: 14, lineHeight: '20px' }}>
                {t('settings.general.worlds.title')}
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: '19px', color: 'var(--cth-ink-700)' }}>
                {t('settings.general.worlds.description')}
              </p>
            </header>

            <div role="list" aria-label={t('settings.general.worlds.selector')} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {worlds.map((world) => {
                const selected = world.id === selectedWorld;
                return (
                  <button
                    key={world.id}
                    type="button"
                    role="listitem"
                    aria-pressed={selected}
                    onClick={() => { void window.cth.updateConfig({ selectedWorld: world.id }); }}
                    style={{
                      padding: '12px 14px', textAlign: 'start', border: 'none', borderRadius: 0,
                      background: selected ? 'var(--cth-ink-900)' : 'var(--cth-cream-200)',
                      color: selected ? 'var(--cth-cream-50)' : 'var(--cth-ink-900)',
                      boxShadow: selected ? 'inset 0 0 0 2px var(--cth-lemon)' : 'inset 0 0 0 1px var(--cth-ink-300)',
                      fontFamily: 'var(--cth-font-display)', fontSize: 9, lineHeight: '14px', cursor: 'pointer'
                    }}
                  >
                    {t(world.labelKey)}
                  </button>
                );
              })}
            </div>

            <PixelButton variant="secondary" size="md" onClick={onReturnToOffice}>
              {t('settings.general.worlds.returnToOffice')}
            </PixelButton>
          </div>
        </PixelPanel>

        <div style={{ position: 'relative', minHeight: 420, background: 'var(--cth-ink-900)' }}>
          {selectedWorld ? <WorldHost config={config} /> : (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--cth-cream-50)', fontFamily: 'var(--cth-font-display)', fontSize: 9 }}>
              {t('settings.general.worlds.selector')}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
