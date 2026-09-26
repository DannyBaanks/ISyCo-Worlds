import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HarnessConfig } from '@/store/config';
import { PixelButton } from './PixelButton';

/** A reversible feature gate; it touches only the two visual-world preferences. */
export function WorldsSettings({ config }: { config: HarnessConfig }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(config.worldsEnabled === true);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setBusy(true);
    try {
      await window.cth.updateConfig({ worldsEnabled: next });
    } catch {
      setEnabled(!next);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, lineHeight: '12px', color: 'var(--cth-ink-500)', textTransform: 'uppercase', marginBottom: 10 }}>
        {t('settings.general.worlds.title')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--cth-ink-900)' }}>{t('settings.general.worlds.enable')}</span>
          <span style={{ fontSize: 12, lineHeight: '16px', color: 'var(--cth-ink-500)' }}>{t('settings.general.worlds.description')}</span>
        </div>
        <PixelButton variant={enabled ? 'primary' : 'secondary'} size="sm" disabled={busy} onClick={() => void toggle()}>
          {enabled ? t('common.on') : t('common.off')}
        </PixelButton>
      </div>
    </div>
  );
}
