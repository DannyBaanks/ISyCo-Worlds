import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HarnessConfig } from '@/store/config';
import type { WorldId } from '@shared/worlds';
import { WORLD_IDS } from '@shared/worlds';
import { PixelButton } from '@/components/PixelButton';
import { PixelPanel } from '@/components/PixelPanel';
import { WorldCredits } from './WorldCredits';

type ProfileStatus = Awaited<ReturnType<typeof window.cth.getWorldProfileStatus>>;
type ActivationResult = Awaited<ReturnType<typeof window.cth.requestWorldProfileActivation>>;

const PROFILE_LABEL_KEYS: Record<WorldId, string> = {
  office: 'settings.general.worlds.office',
  'monster-trainer': 'settings.general.worlds.monsterTrainer'
};

/** Semantic harness profile selector. The selected preference is not active
 * until main has completed the explicit stop/rebind/start lifecycle. */
export function WorldsView({
  config,
  compact = false,
  onActivated
}: {
  config: HarnessConfig;
  compact?: boolean;
  onActivated?: (status: ProfileStatus) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ProfileStatus | null>(null);
  const [selected, setSelected] = useState<WorldId>(config.preferredWorldProfile ?? 'office');
  const [confirmation, setConfirmation] = useState<WorldId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setSelected(config.preferredWorldProfile ?? 'office'); }, [config.preferredWorldProfile]);
  useEffect(() => {
    let cancelled = false;
    void window.cth.getWorldProfileStatus().then((next) => {
      if (cancelled) return;
      setStatus(next);
      setSelected(next.preferredWorldProfile);
    }).catch(() => { if (!cancelled) setError(t('settings.general.worlds.statusUnavailable')); });
    return () => { cancelled = true; };
  }, [t]);

  const acceptResult = async (result: ActivationResult): Promise<void> => {
    if (!result.ok) {
      if (result.error.category === 'confirmation-required') {
        setConfirmation(selected);
      } else {
        setError(`${result.error.phase}: ${result.error.cause.message}`);
      }
      return;
    }
    setConfirmation(null);
    setError(null);
    const next = await window.cth.getWorldProfileStatus();
    setStatus(next);
    setSelected(next.preferredWorldProfile);
    onActivated?.(next);
  };

  const activate = async (confirmed = false): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await acceptResult(confirmed
        ? await window.cth.confirmWorldProfileActivation(selected)
        : await window.cth.requestWorldProfileActivation(selected));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const activeId = status?.activeProfileId;
  const isActiveChoice = activeId === selected;
  const title = compact ? t('settings.general.worlds.title') : t('settings.general.worlds.startupTitle');
  return (
    <section
      aria-label={t('settings.general.worlds.title')}
      style={compact
        ? { width: '100%' }
        : { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--cth-cream-100)' }}
    >
      <PixelPanel variant="default" noPadding style={compact ? {} : { width: 'min(760px, 100%)' }}>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <header>
            <h1 style={{ margin: 0, fontFamily: 'var(--cth-font-display)', fontSize: compact ? 9 : 13, lineHeight: '20px' }}>
              {title}
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: '19px', color: 'var(--cth-ink-700)' }}>
              {t('settings.general.worlds.description')}
            </p>
          </header>

          {status && (
            <div aria-live="polite" style={{ fontSize: 12, lineHeight: '18px', color: 'var(--cth-ink-700)' }}>
              <div>{t('settings.general.worlds.activeProfile')}: <strong>{status.activeProfileId ? t(PROFILE_LABEL_KEYS[status.activeProfileId as WorldId]) : t('settings.general.worlds.noneActive')}</strong></div>
              <div>{t('settings.general.worlds.preferredProfile')}: <strong>{t(PROFILE_LABEL_KEYS[status.preferredWorldProfile])}</strong></div>
            </div>
          )}

          <div role="radiogroup" aria-label={t('settings.general.worlds.selector')} style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {WORLD_IDS.map((profileId) => {
              const chosen = profileId === selected;
              return (
                <button
                  key={profileId}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => { setSelected(profileId); setConfirmation(null); setError(null); }}
                  style={{
                    minHeight: 50, padding: '12px 14px', textAlign: 'start', border: 'none', borderRadius: 0,
                    background: chosen ? 'var(--cth-ink-900)' : 'var(--cth-cream-200)',
                    color: chosen ? 'var(--cth-cream-50)' : 'var(--cth-ink-900)',
                    boxShadow: chosen ? 'inset 0 0 0 2px var(--cth-lemon)' : 'inset 0 0 0 1px var(--cth-ink-300)',
                    fontFamily: 'var(--cth-font-display)', fontSize: 9, lineHeight: '14px', cursor: 'pointer'
                  }}
                >
                  {t(PROFILE_LABEL_KEYS[profileId])}
                  {activeId === profileId && <span style={{ display: 'block', marginTop: 5, fontFamily: 'var(--cth-font-ui)', fontSize: 11 }}>{t('settings.general.worlds.activeTag')}</span>}
                </button>
              );
            })}
          </div>

          <WorldCredits worldId={selected} />

          {confirmation && (
            <div role="alertdialog" aria-label={t('settings.general.worlds.confirmTitle')} style={{ padding: 12, background: 'var(--cth-cream-200)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
              <strong style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9 }}>{t('settings.general.worlds.confirmTitle')}</strong>
              <p style={{ margin: '6px 0 12px', fontSize: 12, lineHeight: '18px' }}>{t('settings.general.worlds.confirmBody', { world: t(PROFILE_LABEL_KEYS[confirmation]) })}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <PixelButton variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmation(null)}>{t('common.cancel')}</PixelButton>
                <PixelButton variant="primary" size="sm" disabled={busy} onClick={() => void activate(true)}>{t('settings.general.worlds.confirmRestart')}</PixelButton>
              </div>
            </div>
          )}

          {error && <div role="alert" style={{ color: 'var(--cth-danger-700)', fontSize: 12 }}>{t('settings.general.worlds.activationFailed')}: {error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PixelButton
              variant="primary"
              size="md"
              disabled={busy || !status || isActiveChoice}
              onClick={() => void activate(false)}
            >
              {busy ? t('settings.general.worlds.activating') : activeId ? t('settings.general.worlds.restartInto', { world: t(PROFILE_LABEL_KEYS[selected]) }) : t('settings.general.worlds.useWorld', { world: t(PROFILE_LABEL_KEYS[selected]) })}
            </PixelButton>
          </div>
        </div>
      </PixelPanel>
    </section>
  );
}
