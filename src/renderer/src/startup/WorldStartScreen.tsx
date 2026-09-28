import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentProvider, HarnessConfig } from '@/store/config';
import { modelsForProvider, onboardingEngineChoices } from '@/store/config';
import { providerPreset } from '@shared/agentProvider';
import { WORLD_IDS, type WorldId } from '@shared/worlds';
import { classifyEngineAvailability, engineAvailabilityBadge, engineBlocksOnboarding } from '@shared/engineAvailability';
import type { ToolStatus } from '@shared/toolCatalog';
import type { WorldProfileRuntimeStatus } from '../../../main/worldProfileLifecycle';
import { planStartupSelection } from './startScreenRoute';
import { Icon } from '@/components/Icon';
import { ProviderLogo } from '@/components/ProviderLogo';
import { PixelButton } from '@/components/PixelButton';
import { LANGUAGES, setLanguage } from '@/i18n';
import buildingsUrl from '@/assets/worlds/starter-village/starter-village-buildings.png?url';
import './world-start-screen.css';

type WorldStatus = WorldProfileRuntimeStatus & { preferredWorldProfile: WorldId };
type ActivationResult = Awaited<ReturnType<typeof window.cth.requestWorldProfileActivation>>;

const PROFILE_LABELS: Record<WorldId, string> = {
  office: 'startScreen.isycoWorld',
  'monster-trainer': 'startScreen.monsterTrainer'
};
const PROFILE_ART_LABEL: Record<WorldId, string> = {
  office: 'ISyCo World',
  'monster-trainer': 'Starter Village'
};
const SKIP_PICKER_ONCE = 'cth.skipHivePickerOnce';
const INPUT_STYLE: CSSProperties = {
  width: '100%', minWidth: 0, padding: '9px 10px', color: '#332719',
  background: '#fff9ea', border: '1px solid #ae8c5b', font: '13px Inter, sans-serif',
  boxSizing: 'border-box'
};

export interface WorldStartScreenProps {
  config: HarnessConfig;
  worldProfileStatus: WorldStatus | null;
  onConfigSaved: (config: HarnessConfig) => void;
  onProfileActivated: (status: WorldStatus) => void;
  onEnter: () => void;
}

function shortName(folder: string): string {
  return folder.split(/[\\/]/).filter(Boolean).pop() ?? folder;
}

export function WorldStartScreen({ config, worldProfileStatus, onConfigSaved, onProfileActivated, onEnter }: WorldStartScreenProps) {
  const { t, i18n } = useTranslation();
  const [setupPending, setSetupPending] = useState(!config.onboardingComplete);
  const firstRun = setupPending;
  const profileTouched = useRef(false);
  const [selectedProfile, setSelectedProfile] = useState<WorldId>(
    config.preferredWorldProfile ?? worldProfileStatus?.preferredWorldProfile ?? 'office'
  );
  const [selectedHome, setSelectedHome] = useState(config.harnessHome ?? '~/HarnessAgents');
  const [provider, setProvider] = useState<AgentProvider>(config.godProvider ?? 'claude');
  const [model, setModel] = useState<string | undefined>(config.godModel ?? providerPreset(config.godProvider ?? 'claude').recommendedOrchestratorModel);
  const [audience, setAudience] = useState<'technical' | 'non-technical'>(config.audience ?? 'non-technical');
  const [autoMode, setAutoMode] = useState(config.autoMode ?? true);
  const [shareStats, setShareStats] = useState(config.telemetryEnabled !== false);
  const [strongKeepalive, setStrongKeepalive] = useState(config.strongKeepalive === true);
  const [notifications, setNotifications] = useState(config.notifications === true);
  const [openAtLogin, setOpenAtLogin] = useState(false);
  const [projects, setProjects] = useState<string[]>(config.registeredRepos ?? []);
  const [engines, setEngines] = useState<ToolStatus[] | undefined>();
  const [checkingEngines, setCheckingEngines] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmProfile, setConfirmProfile] = useState(false);
  const [createParent, setCreateParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    let cancelled = false;
    void window.cth.toolsStatus().then((next) => { if (!cancelled) setEngines(next); }).catch(() => { /* an unavailable probe must not lock out entry */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!profileTouched.current && worldProfileStatus) setSelectedProfile(worldProfileStatus.preferredWorldProfile);
  }, [worldProfileStatus]);

  const eligibleEngines = onboardingEngineChoices().eligible;
  const engineStatus = classifyEngineAvailability(engines, provider);
  const engineBlocked = engineBlocksOnboarding(engineStatus);
  const activeProfileId = worldProfileStatus?.activeProfileId;
  const activeWorldUnavailable = worldProfileStatus?.state === 'ERROR' || !!worldProfileStatus?.error;
  const recents = (config.recentHives ?? []).filter((home) => home && home !== config.harnessHome);

  const pickWorkspace = async () => {
    setError(null);
    const result = await window.cth.chooseFolder();
    if (result.ok) { setSelectedHome(result.path); setCreateParent(null); }
    else if (result.error !== 'cancelled') setError(result.error);
  };

  const startCreateWorkspace = async () => {
    setError(null);
    const result = await window.cth.chooseFolder();
    if (result.ok) { setCreateParent(result.path); setNewFolderName(''); }
    else if (result.error !== 'cancelled') setError(result.error);
  };

  const createWorkspace = async () => {
    if (!createParent || !newFolderName.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const result = await window.cth.createHome(createParent, newFolderName.trim());
      if (!result.ok) { setError(result.error ?? t('hivePicker.errCreate')); return; }
      setSelectedHome(result.path);
      setCreateParent(null);
      setNewFolderName('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(false); }
  };

  const addProject = async () => {
    setError(null);
    const result = await window.cth.chooseFolder();
    if (result.ok && !projects.includes(result.path)) setProjects((current) => [...current, result.path]);
    else if (!result.ok && result.error !== 'cancelled') setError(result.error);
  };

  const updateKeepalive = async (value: boolean) => {
    setStrongKeepalive(value);
    try { setStrongKeepalive((await window.cth.updateConfig({ strongKeepalive: value })).strongKeepalive === true); }
    catch { setStrongKeepalive(!value); }
  };

  const updateNotifications = async (value: boolean) => {
    setNotifications(value);
    try { await window.cth.setNotifications(value); }
    catch { setNotifications(!value); }
  };

  const updateOpenAtLogin = async (value: boolean) => {
    setOpenAtLogin(value);
    try { setOpenAtLogin(await window.cth.setLoginItem(value)); }
    catch { setOpenAtLogin(!value); }
  };

  const saveFirstRun = async (): Promise<HarnessConfig | null> => {
    const home = selectedHome.trim();
    if (!home) { setError(t('onboarding.errPickHome')); return null; }
    if (engineBlocked) {
      setError(t('onboarding.errEngineNotInstalled', { label: providerPreset(provider).label }));
      return null;
    }
    const ensured = await window.cth.ensureHarnessHome(home);
    if (!ensured.ok) { setError(ensured.error ?? t('onboarding.errCreateHome')); return null; }
    const next = await window.cth.updateConfig({
      onboardingComplete: true,
      audience,
      harnessHome: home,
      registeredRepos: projects,
      autoMode,
      godProvider: provider,
      godModel: model,
      telemetryEnabled: shareStats,
      preferredWorldProfile: selectedProfile
    });
    onConfigSaved(next);
    return next;
  };

  const activateSelectedProfile = async (confirmed: boolean): Promise<boolean> => {
    const result: ActivationResult = confirmed
      ? await window.cth.confirmWorldProfileActivation(selectedProfile)
      : await window.cth.requestWorldProfileActivation(selectedProfile);
    if (!result.ok) {
      if (result.error.category === 'confirmation-required') {
        setConfirmProfile(true);
        return false;
      }
      setError(`${result.error.phase}: ${result.error.cause.message}`);
      return false;
    }
    const next = await window.cth.getWorldProfileStatus();
    onProfileActivated(next);
    setConfirmProfile(false);
    return true;
  };

  const enter = async (confirmed = false) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let latestConfig = config;
      if (firstRun) {
        const saved = await saveFirstRun();
        if (!saved) return;
        latestConfig = saved;
      }

      const status = worldProfileStatus ?? await window.cth.getWorldProfileStatus();
      const plan = planStartupSelection({
        selectedHome,
        currentHome: config.harnessHome ?? null,
        selectedProfileId: selectedProfile,
        activeProfileId: status.activeProfileId
      });
      if (!firstRun && plan.type === 'switch-harness') {
        // `changeHome` relaunches Electron. Persist the selected profile first so
        // main bootstraps that world's capabilities in the new workspace; never
        // run a second profile restart before the harness switch.
        const previousPreference = latestConfig.preferredWorldProfile ?? status.preferredWorldProfile;
        const saved = await window.cth.updateConfig({ preferredWorldProfile: plan.preferredProfileId });
        onConfigSaved(saved);
        window.localStorage.setItem(SKIP_PICKER_ONCE, '1');
        let switched: Awaited<ReturnType<typeof window.cth.changeHome>>;
        try {
          switched = await window.cth.changeHome(plan.harnessHome, 'fresh');
        } catch (cause) {
          window.localStorage.removeItem(SKIP_PICKER_ONCE);
          await window.cth.updateConfig({ preferredWorldProfile: previousPreference }).catch(() => undefined);
          throw cause;
        }
        if (!switched.ok) {
          window.localStorage.removeItem(SKIP_PICKER_ONCE);
          await window.cth.updateConfig({ preferredWorldProfile: previousPreference });
          setError(switched.error ?? t('hivePicker.errOpen'));
        }
        return;
      }

      if (plan.type === 'activate-profile') {
        const activated = await activateSelectedProfile(confirmed);
        if (!activated) return;
      }
      setSetupPending(false);
      onEnter();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(false); }
  };

  return (
    <main className="cth-world-start" aria-label={t('startScreen.title')}>
      <div className="cth-world-start-frame">
        <header className="cth-world-start-header">
          <div className="cth-world-start-brand" aria-label="ISyCo World">
            <span className="cth-world-start-globe" aria-hidden="true"><Icon name="web" /></span>
            <span>ISyCo World</span>
          </div>
          <div className="cth-world-start-welcome">
            <h1>{t('startScreen.title')}</h1>
            <p>{t('startScreen.intro')}</p>
          </div>
          <label className="cth-world-start-language">
            <span>{t('startScreen.language')}</span>
            <select value={i18n.language} onChange={(event) => setLanguage(event.target.value)}>
              {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
            </select>
          </label>
        </header>

        <div className="cth-world-start-content">
          <section className="cth-world-start-landscape" aria-labelledby="start-world-heading">
            <div className="cth-world-start-world-title">
              <span className="cth-world-start-kicker">{t('startScreen.world')}</span>
              <h2 id="start-world-heading">{t(PROFILE_LABELS[selectedProfile])}</h2>
              <span className="cth-world-start-landmark">{PROFILE_ART_LABEL[selectedProfile]}</span>
            </div>
            <div className="cth-world-start-art-window" aria-hidden="true">
              <div className="cth-world-start-skyline" />
              <img src={buildingsUrl} alt="" />
            </div>
            <div className="cth-world-start-world-options" role="radiogroup" aria-label={t('settings.general.worlds.selector')}>
              {WORLD_IDS.map((profileId) => {
                const chosen = selectedProfile === profileId;
                return (
                  <button
                    className={`cth-world-start-world-choice${chosen ? ' is-selected' : ''}`}
                    type="button" role="radio" aria-checked={chosen} key={profileId}
                    onClick={() => { profileTouched.current = true; setSelectedProfile(profileId); setConfirmProfile(false); setError(null); }}
                  >
                    <span className="cth-world-start-world-icon"><Icon name={profileId === 'office' ? 'web' : 'sparkle'} /></span>
                    <span>{t(PROFILE_LABELS[profileId])}</span>
                    {worldProfileStatus?.activeProfileId === profileId && <small>{t('startScreen.active')}</small>}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="cth-world-start-side">
            <section className="cth-start-ledger" aria-labelledby="start-workspace-heading">
              <div className="cth-start-ledger-title">
                <span className="cth-world-start-kicker">{t('startScreen.workspace')}</span>
                <h2 id="start-workspace-heading">{t('startScreen.workspaceTitle')}</h2>
              </div>
              {firstRun ? (
                <div className="cth-start-workspace-input">
                  <label htmlFor="world-start-home">{t('startScreen.chooseWorkspace')}</label>
                  <div className="cth-start-input-row">
                    <input id="world-start-home" value={selectedHome} onChange={(event) => setSelectedHome(event.target.value)} style={INPUT_STYLE} />
                    <PixelButton variant="secondary" size="md" onClick={() => void pickWorkspace()} disabled={busy}>{t('startScreen.browseWorkspace')}</PixelButton>
                  </div>
                  <p>{t(audience === 'non-technical' ? 'onboarding.home.notePlain' : 'onboarding.home.note')}</p>
                </div>
              ) : (
                <div className="cth-start-workspace-list" role="radiogroup" aria-label={t('startScreen.chooseWorkspace')}>
                  {config.harnessHome && <WorkspaceOption path={config.harnessHome} selected={selectedHome === config.harnessHome} label={t('startScreen.currentWorkspace')} onSelect={setSelectedHome} />}
                  {recents.map((home) => <WorkspaceOption key={home} path={home} selected={selectedHome === home} label={t('startScreen.recentWorkspaces')} onSelect={setSelectedHome} />)}
                  <div className="cth-start-input-row">
                    <PixelButton variant="secondary" size="md" onClick={() => void pickWorkspace()} disabled={busy}>{t('startScreen.browseWorkspace')}</PixelButton>
                    <PixelButton variant="ghost" size="md" onClick={() => void startCreateWorkspace()} disabled={busy}>{t('startScreen.createWorkspace')}</PixelButton>
                  </div>
                </div>
              )}

              {createParent && (
                <div className="cth-start-create-form">
                  <div className="cth-start-create-parent"><strong>{t('startScreen.createAt')}:</strong> {createParent}</div>
                  <div className="cth-start-input-row">
                    <input aria-label={t('startScreen.workspaceName')} placeholder={t('hivePicker.folderNamePlaceholder')} value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} style={INPUT_STYLE} />
                    <PixelButton variant="primary" size="md" onClick={() => void createWorkspace()} disabled={busy || !newFolderName.trim()}>{t('startScreen.createWorkspace')}</PixelButton>
                    <PixelButton variant="ghost" size="md" onClick={() => setCreateParent(null)} disabled={busy}>{t('hivePicker.cancel')}</PixelButton>
                  </div>
                </div>
              )}

              {selectedHome !== config.harnessHome && !firstRun && <p className="cth-start-switch-note">{t('startScreen.switchNote')}</p>}
            </section>

            {firstRun && (
              <details className="cth-start-setup" open>
                <summary>{t('startScreen.firstRunSetup')}</summary>
                <div className="cth-start-setup-body">
                  <div className="cth-start-guidance">
                    <div className="cth-world-start-kicker">{t('startScreen.guidance')}</div>
                    <div className="cth-start-guidance-buttons">
                      {(['non-technical', 'technical'] as const).map((choice) => (
                        <button key={choice} type="button" aria-pressed={audience === choice} onClick={() => setAudience(choice)}>
                          {t(choice === 'technical' ? 'startScreen.technical' : 'startScreen.guided')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="cth-start-field">
                    <span>{t('startScreen.engine')}</span>
                    <span className="cth-start-provider-select">
                      <ProviderLogo provider={provider} size={18} />
                      <select value={provider} onChange={(event) => { const next = event.target.value as AgentProvider; setProvider(next); setModel(providerPreset(next).recommendedOrchestratorModel); }}>
                        {eligibleEngines.map((entry) => {
                          const badge = engineAvailabilityBadge(classifyEngineAvailability(engines, entry.id));
                          return <option key={entry.id} value={entry.id}>{entry.label}{badge ? ` · ${badge}` : ''}</option>;
                        })}
                      </select>
                      <button type="button" onClick={() => { setCheckingEngines(true); void window.cth.toolsStatus().then(setEngines).catch(() => {}).finally(() => setCheckingEngines(false)); }} disabled={checkingEngines} aria-label={t('onboarding.orchestrator.recommended')}>{checkingEngines ? '…' : '↻'}</button>
                    </span>
                  </label>
                  <label className="cth-start-field">
                    <span>{t('onboarding.orchestrator.model')}</span>
                    <select value={model ?? ''} onChange={(event) => setModel(event.target.value || undefined)}>
                      {modelsForProvider(provider).map((entry) => <option key={entry.label} value={entry.id ?? ''}>{entry.label}</option>)}
                    </select>
                  </label>
                  {engineBlocked && <p className="cth-start-inline-error">{t('onboarding.errEngineNotInstalled', { label: providerPreset(provider).label })}</p>}

                  <div className="cth-start-projects">
                    <div className="cth-world-start-kicker">{t('startScreen.projects')}</div>
                    {projects.length === 0 && <p>{t('startScreen.noProjects')}</p>}
                    {projects.map((project) => (
                      <div className="cth-start-project-row" key={project}>
                        <Icon name="folder" /><span title={project}>{shortName(project)}</span>
                        <button type="button" aria-label={`Remove ${project}`} onClick={() => setProjects((current) => current.filter((item) => item !== project))}>×</button>
                      </div>
                    ))}
                    <PixelButton variant="secondary" size="sm" onClick={() => void addProject()} disabled={busy}><Icon name="plus" />{t('startScreen.addProject')}</PixelButton>
                  </div>

                  <div className="cth-start-preferences">
                    <div className="cth-world-start-kicker">{t('startScreen.preferences')}</div>
                    <PreferenceRow label={t('onboarding.permissions.autoLabelPlain')} checked={autoMode} onChange={setAutoMode} />
                    <PreferenceRow label={t('onboarding.permissions.keepAwake')} description={t('onboarding.permissions.keepAwakeDesc')} checked={strongKeepalive} onChange={(value) => void updateKeepalive(value)} />
                    <PreferenceRow label={t('onboarding.permissions.notifications')} checked={notifications} onChange={(value) => void updateNotifications(value)} />
                    <PreferenceRow label={t('onboarding.permissions.openAtLogin')} checked={openAtLogin} onChange={(value) => void updateOpenAtLogin(value)} />
                    <PreferenceRow label={t('onboarding.permissions.shareStats')} description={t('onboarding.permissions.shareStatsDesc')} checked={shareStats} onChange={setShareStats} />
                  </div>
                </div>
              </details>
            )}

            {confirmProfile && (
              <div className="cth-start-confirm" role="alertdialog" aria-label={t('settings.general.worlds.confirmTitle')}>
                <strong>{t('settings.general.worlds.confirmTitle')}</strong>
                <p>{t('settings.general.worlds.confirmBody', { world: t(PROFILE_LABELS[selectedProfile]) })}</p>
                <div>
                  <PixelButton variant="secondary" size="sm" onClick={() => setConfirmProfile(false)} disabled={busy}>{t('hivePicker.cancel')}</PixelButton>
                  <PixelButton variant="primary" size="sm" onClick={() => void enter(true)} disabled={busy}>{t('settings.general.worlds.confirmRestart')}</PixelButton>
                </div>
              </div>
            )}

            {activeWorldUnavailable && worldProfileStatus?.error && <p className="cth-start-inline-error">{worldProfileStatus.error.phase}: {worldProfileStatus.error.cause.message}</p>}
            {error && <p className="cth-start-inline-error" role="alert">{error}</p>}
          </div>
        </div>

        <footer className="cth-world-start-footer">
          <div className="cth-world-start-footnote">
            <span className="cth-world-start-ember" aria-hidden="true" />
            {firstRun ? t('onboarding.persona.bodyLocal') : `${shortName(selectedHome)} · ${t(PROFILE_LABELS[selectedProfile])}`}
          </div>
          <PixelButton variant="primary" size="lg" onClick={() => void enter()} disabled={busy || !selectedHome.trim()}>
            {busy ? t('startScreen.opening') : t('startScreen.primary')}
            {!busy && <Icon name="arrow-right" />}
          </PixelButton>
        </footer>
      </div>
    </main>
  );
}

function WorkspaceOption({ path, selected, label, onSelect }: { path: string; selected: boolean; label: string; onSelect: (path: string) => void }) {
  return (
    <button className={`cth-start-workspace-option${selected ? ' is-selected' : ''}`} type="button" role="radio" aria-checked={selected} onClick={() => onSelect(path)}>
      <span className="cth-start-workspace-mark"><Icon name={selected ? 'check' : 'folder'} /></span>
      <span className="cth-start-workspace-copy"><strong>{shortName(path)}</strong><small>{label}</small><code title={path}>{path}</code></span>
      {selected && <span className="cth-start-workspace-check" aria-hidden="true">✓</span>}
    </button>
  );
}

function PreferenceRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="cth-start-preference-row">
      <span><strong>{label}</strong>{description && <small>{description}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
