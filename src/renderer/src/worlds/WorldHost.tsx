import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { HarnessConfig } from '@/store/config';
import { OfficeFloor } from '@/scene/office/OfficeFloor';
import { PixelButton } from '@/components/PixelButton';
import { worldById } from './worldRegistry';
import { MonsterTrainerSurface } from './monster/MonsterTrainerSurface';

class WorldErrorBoundary extends Component<{ onFailure: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    this.props.onFailure();
  }

  render(): ReactNode {
    return this.state.failed ? <OfficeFloor /> : this.props.children;
  }
}

function OfficeFallback({ onReturn }: { onReturn?: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <OfficeFloor />
      {onReturn && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20 }}>
          <PixelButton variant="secondary" size="sm" onClick={onReturn}>
            {t('settings.general.worlds.returnToOffice')}
          </PixelButton>
        </div>
      )}
    </>
  );
}

/**
 * The host is the only switchpoint. Until a registered experimental renderer
 * exists, it falls back to Office; neither route changes hive or task state.
 */
export function WorldHost({ config }: { config: HarnessConfig }) {
  const { t } = useTranslation();
  const requestedId = config.worldsEnabled ? config.selectedWorld : 'office';
  const world = worldById(requestedId);
  const returnToOffice = () => { void window.cth.updateConfig({ selectedWorld: 'office' }); };

  if (!config.worldsEnabled || world.id === 'office') return <OfficeFallback />;

  return (
    <WorldErrorBoundary onFailure={returnToOffice}>
      {world.id === 'monster-trainer' ? <MonsterTrainerSurface /> : <OfficeFallback />}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20 }}>
        <PixelButton variant="secondary" size="sm" onClick={returnToOffice}>
          {t('settings.general.worlds.returnToOffice')}
        </PixelButton>
      </div>
    </WorldErrorBoundary>
  );
}
