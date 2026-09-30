import { useTranslation } from 'react-i18next';
import { useStore } from '@/store/store';
import { HangingSign, ParchmentSurface } from './WorldMaterials';

/** Counts are projections of the live roster, never decorative progress bars. */
export function WorldStatusLedger() {
  const {t} = useTranslation();
  const agents = useStore(s => s.agents);
  const working = agents.filter(a => ['working', 'thinking'].includes(a.status)).length;
  const waiting = agents.filter(a => ['blocked', 'waiting'].includes(a.status)).length;
  return <ParchmentSurface className="worlds-status-ledger">
    <HangingSign>{t('worldsVisual.worldStatus')}</HangingSign>
    <dl>
      <div><dt>{t('worldsVisual.crew')}</dt><dd>{agents.length}</dd></div>
      <div><dt>{t('worldsVisual.working')}</dt><dd>{working}</dd></div>
      <div><dt>{t('worldsVisual.waiting')}</dt><dd>{waiting}</dd></div>
    </dl>
  </ParchmentSurface>;
}
