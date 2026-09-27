import { useState } from 'react';
import type { CompositionCommand, WorldCompositionV1 } from '@shared/worldComposition';

export interface FreeBuildCatalogItem {
  id: string;
  label: string;
  kind: 'structure' | 'prop';
  removable: boolean;
}

export interface FreeBuildToolbarProps {
  catalog: readonly FreeBuildCatalogItem[];
  terrainIds: readonly string[];
  layout: WorldCompositionV1;
  mode: 'explore' | 'build';
  onModeChange: (mode: 'explore' | 'build') => void;
  onCommand: (command: CompositionCommand) => void;
  onSelectPlacement: (placementId: string) => void;
  onUndo: () => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
  feedback?: string;
}

/** Generic controls for visual layout only; world-specific labels/art stay in the supplied catalog. */
export function FreeBuildToolbar(props: FreeBuildToolbarProps) {
  const [definitionId, setDefinitionId] = useState(props.catalog[0]?.id ?? '');
  const [terrainId, setTerrainId] = useState(props.terrainIds[0] ?? '');
  const [placementId, setPlacementId] = useState(props.layout.placements[0]?.id ?? '');
  const [x, setX] = useState('0');
  const [y, setY] = useState('0');

  const coords = (): { x: number; y: number } | null => {
    const nextX = Number(x);
    const nextY = Number(y);
    return Number.isSafeInteger(nextX) && Number.isSafeInteger(nextY) ? { x: nextX, y: nextY } : null;
  };
  const send = (command: CompositionCommand): void => props.onCommand(command);
  const buttonStyle = { font: '12px monospace', padding: '4px 7px', cursor: 'pointer' };

  return (
    <section aria-label="Village composition controls" data-free-build-toolbar={props.mode}
      style={{ position: 'absolute', zIndex: 10, left: 8, top: 8, width: 236, maxHeight: 'calc(100% - 16px)', overflow: 'auto', padding: 8, background: 'rgba(19,37,50,.96)', color: '#f1db9d', border: '2px solid #d99a58', boxShadow: '3px 3px 0 #132532', font: '11px monospace' }}>
      <header style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
        <button style={buttonStyle} aria-pressed={props.mode === 'explore'} onClick={() => props.onModeChange('explore')}>Explore</button>
        <button style={buttonStyle} aria-pressed={props.mode === 'build'} onClick={() => props.onModeChange('build')}>Build</button>
      </header>
      {props.mode === 'build' && <>
        <label style={{ display: 'grid', gap: 3, marginBottom: 6 }}>Object
          <select value={definitionId} onChange={(event) => setDefinitionId(event.target.value)}>
            {props.catalog.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 4, marginBottom: 7 }}>
          <label>X <input aria-label="Grid X" inputMode="numeric" value={x} onChange={(event) => setX(event.target.value)} style={{ width: 42 }} /></label>
          <label>Y <input aria-label="Grid Y" inputMode="numeric" value={y} onChange={(event) => setY(event.target.value)} style={{ width: 42 }} /></label>
          <button style={buttonStyle} onClick={() => {
            const point = coords();
            if (point && definitionId) {
              const id = `build-${Date.now().toString(36)}`;
              send({ type: 'place-object', placement: { id, definitionId, ...point } });
              setPlacementId(id);
              props.onSelectPlacement(id);
            }
          }}>Place</button>
        </div>
        <label style={{ display: 'grid', gap: 3, marginBottom: 6 }}>Placed object
          <select value={placementId} onChange={(event) => { setPlacementId(event.target.value); props.onSelectPlacement(event.target.value); }}>
            {props.layout.placements.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <button style={buttonStyle} onClick={() => { const point = coords(); if (point && placementId) send({ type: 'move-object', placementId, ...point }); }}>Move</button>
          <button style={buttonStyle} onClick={() => { if (placementId) send({ type: 'remove-object', placementId }); }}>Remove</button>
        </div>
        <label style={{ display: 'grid', gap: 3, marginBottom: 6 }}>Terrain brush
          <select value={terrainId} onChange={(event) => setTerrainId(event.target.value)}>
            <option value="">Erase brush override</option>
            {props.terrainIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        <button style={buttonStyle} onClick={() => {
          const point = coords();
          if (point) send({ type: 'paint-terrain', ...point, terrainId: terrainId || null });
        }}>Paint cell</button>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          <button style={buttonStyle} onClick={props.onUndo}>Undo</button>
          <button style={buttonStyle} onClick={props.onCancel}>Cancel</button>
          <button style={buttonStyle} onClick={props.onSave}>Save</button>
          <button style={buttonStyle} onClick={props.onReset}>Reset preset</button>
        </div>
        {props.feedback && <p role="status" style={{ color: '#ffe0b2', whiteSpace: 'pre-wrap' }}>{props.feedback}</p>}
      </>}
    </section>
  );
}
