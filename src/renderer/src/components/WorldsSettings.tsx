import type { HarnessConfig } from '@/store/config';
import { WorldsView } from '@/worlds/WorldsView';

/** The General settings entry is the explicit, confirmation-gated profile restart control. */
export function WorldsSettings({ config }: { config: HarnessConfig }) {
  return <WorldsView config={config} compact />;
}
