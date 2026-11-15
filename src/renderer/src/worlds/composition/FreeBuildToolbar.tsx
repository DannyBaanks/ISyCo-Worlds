import { useTranslation } from 'react-i18next';
import { MAX_CITY_SPAN, type CompositionCommand, type WorldCompositionV1 } from '@shared/worldComposition';

export interface FreeBuildCatalogItem {
  id: string;
  label: string;
  kind: 'structure' | 'prop';
  removable: boolean;
}

export type BuildTool =
  | { kind: 'place'; definitionId: string }
  | { kind: 'paint'; terrainId: string | null }
  | { kind: 'move' };

export const CITY_EXPAND_STEP = 16;

export function placeCommand(definitionId: string, cell: { x: number; y: number }, id: string): CompositionCommand {
  return { type: 'place-object', placement: { id, definitionId, x: cell.x, y: cell.y } };
}

export function paintCommand(cell: { x: number; y: number }, terrainId: string | null): CompositionCommand {
  return { type: 'paint-terrain', x: cell.x, y: cell.y, terrainId };
}

export function moveCommand(placementId: string, cell: { x: number; y: number }): CompositionCommand {
  return { type: 'move-object', placementId, x: cell.x, y: cell.y };
}

export function resizeCommand(columns: number, rows: number): CompositionCommand {
  return { type: 'resize-map', columns, rows };
}

export interface FreeBuildToolbarProps {
  catalog: readonly FreeBuildCatalogItem[];
  terrainIds: readonly string[];
  layout: WorldCompositionV1;
  baseColumns: number;
  baseRows: number;
  mode: 'explore' | 'build';
  tool: BuildTool;
  zoomPercent: number;
  onModeChange: (mode: 'explore' | 'build') => void;
  onToolChange: (tool: BuildTool) => void;
  onCommand: (command: CompositionCommand) => void;
  onUndo: () => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
  onFit: () => void;
  feedback?: string;
}

/** Generic controls for visual layout only; world-specific labels stay in the supplied catalog. */
export function FreeBuildToolbar(props: FreeBuildToolbarProps) {
  const { t } = useTranslation();
  const columns = props.layout.columns ?? props.baseColumns;
  const rows = props.layout.rows ?? props.baseRows;
  const grow = (nextColumns: number, nextRows: number): void => {
    props.onCommand(resizeCommand(nextColumns, nextRows));
  };

  return (
    <section aria-label={t('worldsVisual.build.label', { defaultValue: 'Village composition controls' })} data-free-build-toolbar={props.mode}
      className="village-build-bar">
      <header>
        <button type="button" className="village-build-key" aria-pressed={props.mode === 'explore'} onClick={() => props.onModeChange('explore')}>{t('worldsVisual.build.explore', { defaultValue: 'Explore' })}</button>
        <button type="button" className="village-build-key" aria-pressed={props.mode === 'build'} onClick={() => props.onModeChange('build')}>{t('worldsVisual.build.build', { defaultValue: 'Build' })}</button>
        <span className="village-build-zoom">{props.zoomPercent}%</span>
        <button type="button" className="village-build-key" onClick={props.onFit}>{t('worldsVisual.build.fit', { defaultValue: 'Fit' })}</button>
      </header>
      {props.mode === 'build' && <>
        <p>{t('worldsVisual.build.hint', { defaultValue: 'Pick a piece, then click the map. Wheel zooms. Middle-drag looks around.' })}</p>
        <div className="village-build-row">
          {props.catalog.map((item) => {
            const pressed = props.tool.kind === 'place' && props.tool.definitionId === item.id;
            return <button type="button" key={item.id} aria-pressed={pressed} className="village-build-key" onClick={() => props.onToolChange({ kind: 'place', definitionId: item.id })}>{item.label}</button>;
          })}
        </div>
        <div className="village-build-row">
          <button type="button" aria-pressed={props.tool.kind === 'move'} className="village-build-key" onClick={() => props.onToolChange({ kind: 'move' })}>{t('worldsVisual.build.move', { defaultValue: 'Move' })}</button>
          {props.terrainIds.map((id) => {
            const pressed = props.tool.kind === 'paint' && props.tool.terrainId === id;
            return <button type="button" key={id} aria-pressed={pressed} className="village-build-key" onClick={() => props.onToolChange({ kind: 'paint', terrainId: id })}>{id}</button>;
          })}
          <button type="button" aria-pressed={props.tool.kind === 'paint' && props.tool.terrainId === null} className="village-build-key" onClick={() => props.onToolChange({ kind: 'paint', terrainId: null })}>{t('worldsVisual.build.erase', { defaultValue: 'Erase' })}</button>
        </div>
        <div className="village-build-row">
          <span>{t('worldsVisual.build.city', { defaultValue: 'City' })} {columns}×{rows}</span>
          <button type="button" className="village-build-key" disabled={columns + CITY_EXPAND_STEP > MAX_CITY_SPAN} onClick={() => grow(columns + CITY_EXPAND_STEP, rows)}>{t('worldsVisual.build.wider', { defaultValue: 'Wider' })}</button>
          <button type="button" className="village-build-key" disabled={rows + CITY_EXPAND_STEP > MAX_CITY_SPAN} onClick={() => grow(columns, rows + CITY_EXPAND_STEP)}>{t('worldsVisual.build.taller', { defaultValue: 'Taller' })}</button>
          <button type="button" className="village-build-key" disabled={columns + CITY_EXPAND_STEP > MAX_CITY_SPAN || rows + CITY_EXPAND_STEP > MAX_CITY_SPAN} onClick={() => grow(columns + CITY_EXPAND_STEP, rows + CITY_EXPAND_STEP)}>{t('worldsVisual.build.expand', { defaultValue: 'Expand' })}</button>
        </div>
        <div className="village-build-row">
          <button type="button" className="village-build-key" onClick={props.onUndo}>{t('worldsVisual.build.undo', { defaultValue: 'Undo' })}</button>
          <button type="button" className="village-build-key" onClick={props.onCancel}>{t('worldsVisual.build.cancel', { defaultValue: 'Cancel' })}</button>
          <button type="button" className="village-build-key" onClick={props.onSave}>{t('worldsVisual.build.save', { defaultValue: 'Save' })}</button>
          <button type="button" className="village-build-key" onClick={props.onReset}>{t('worldsVisual.build.reset', { defaultValue: 'Reset preset' })}</button>
        </div>
        {props.feedback && <p role="status" style={{ whiteSpace: 'pre-wrap' }}>{props.feedback}</p>}
      </>}
    </section>
  );
}
