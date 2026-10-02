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
  const columns = props.layout.columns ?? props.baseColumns;
  const rows = props.layout.rows ?? props.baseRows;
  const buttonStyle = { font: '12px monospace', padding: '4px 7px', cursor: 'pointer' };
  const chip = (pressed: boolean) => ({
    ...buttonStyle,
    background: pressed ? '#2f755b' : '#132532',
    color: '#f1db9d',
    border: pressed ? '2px solid #bdfcf0' : '2px solid #d99a58'
  });
  const grow = (nextColumns: number, nextRows: number): void => {
    props.onCommand(resizeCommand(nextColumns, nextRows));
  };

  return (
    <section aria-label="Village composition controls" data-free-build-toolbar={props.mode}
      style={{ position: 'relative', zIndex: 10, flex: '0 0 auto', margin: 8, padding: 8, background: 'rgba(19,37,50,.96)', color: '#f1db9d', border: '2px solid #d99a58', boxShadow: '3px 3px 0 #132532', font: '11px monospace' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8, alignItems: 'center' }}>
        <button type="button" style={buttonStyle} aria-pressed={props.mode === 'explore'} onClick={() => props.onModeChange('explore')}>Explore</button>
        <button type="button" style={buttonStyle} aria-pressed={props.mode === 'build'} onClick={() => props.onModeChange('build')}>Build</button>
        <span style={{ marginLeft: 'auto' }}>{props.zoomPercent}%</span>
        <button type="button" style={buttonStyle} onClick={props.onFit}>Fit</button>
      </header>
      {props.mode === 'build' && <>
        <p style={{ margin: '0 0 6px' }}>Pick a piece, then click the map. Wheel zooms. Middle-drag looks around.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {props.catalog.map((item) => {
            const pressed = props.tool.kind === 'place' && props.tool.definitionId === item.id;
            return <button type="button" key={item.id} aria-pressed={pressed} style={chip(pressed)} onClick={() => props.onToolChange({ kind: 'place', definitionId: item.id })}>{item.label}</button>;
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          <button type="button" aria-pressed={props.tool.kind === 'move'} style={chip(props.tool.kind === 'move')} onClick={() => props.onToolChange({ kind: 'move' })}>Move</button>
          {props.terrainIds.map((id) => {
            const pressed = props.tool.kind === 'paint' && props.tool.terrainId === id;
            return <button type="button" key={id} aria-pressed={pressed} style={chip(pressed)} onClick={() => props.onToolChange({ kind: 'paint', terrainId: id })}>{id}</button>;
          })}
          <button type="button" aria-pressed={props.tool.kind === 'paint' && props.tool.terrainId === null} style={chip(props.tool.kind === 'paint' && props.tool.terrainId === null)} onClick={() => props.onToolChange({ kind: 'paint', terrainId: null })}>Erase</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 8 }}>
          <span>City {columns}×{rows}</span>
          <button type="button" style={buttonStyle} disabled={columns + CITY_EXPAND_STEP > MAX_CITY_SPAN} onClick={() => grow(columns + CITY_EXPAND_STEP, rows)}>Wider</button>
          <button type="button" style={buttonStyle} disabled={rows + CITY_EXPAND_STEP > MAX_CITY_SPAN} onClick={() => grow(columns, rows + CITY_EXPAND_STEP)}>Taller</button>
          <button type="button" style={buttonStyle} disabled={columns + CITY_EXPAND_STEP > MAX_CITY_SPAN || rows + CITY_EXPAND_STEP > MAX_CITY_SPAN} onClick={() => grow(columns + CITY_EXPAND_STEP, rows + CITY_EXPAND_STEP)}>Expand</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button type="button" style={buttonStyle} onClick={props.onUndo}>Undo</button>
          <button type="button" style={buttonStyle} onClick={props.onCancel}>Cancel</button>
          <button type="button" style={buttonStyle} onClick={props.onSave}>Save</button>
          <button type="button" style={buttonStyle} onClick={props.onReset}>Reset preset</button>
        </div>
        {props.feedback && <p role="status" style={{ color: '#ffe0b2', whiteSpace: 'pre-wrap' }}>{props.feedback}</p>}
      </>}
    </section>
  );
}
