'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const Composition = loadTs('src/shared/worldComposition.ts');

const definition = {
  scenarioId: 'test-village',
  columns: 8,
  rows: 8,
  terrainIds: ['grass', 'path', 'training-grass'],
  objects: {
    lab: {
      id: 'lab', kind: 'structure', assetId: 'lab-house', footprint: { width: 2, height: 2 },
      movable: true, removable: false,
      semanticAnchors: { professor: { x: 1, y: 1 } },
      stationKind: 'research', affinities: ['water'],
      interactionSlots: [{ id: 'bench', kind: 'research', capacity: 2 }],
      interactionPoints: { entrance: { x: 1, y: 2 }, work: { x: 2, y: 1 }, idle: { x: 1, y: 1 } }
    },
    rock: {
      id: 'rock', kind: 'prop', assetId: 'rock', footprint: { width: 1, height: 1 },
      movable: true, removable: true
    }
  }
};

const layout = {
  version: 1,
  scenarioId: 'test-village',
  placements: [{ id: 'lab-1', definitionId: 'lab', x: 2, y: 2 }],
  terrain: [{ x: 3, y: 4, terrainId: 'training-grass' }]
};

function state(present = layout) { return { present, past: [] }; }

test('the generic composition module loads without Monster Trainer or renderer dependencies', () => {
  assert.equal(typeof Composition.validateComposition, 'function');
  assert.equal(typeof Composition.applyCompositionCommand, 'function');
});

test('WorldCompositionV1 requires versioned placements and terrain', () => {
  assert.equal(Composition.isWorldCompositionV1(layout), true);
  assert.equal(Composition.isWorldCompositionV1({ ...layout, terrain: undefined }), false);
  assert.equal(Composition.isWorldCompositionV1({ ...layout, version: 2 }), false);
  assert.equal(Composition.isWorldCompositionV1({ ...layout, placements: [{ id: 'x', definitionId: '', x: 0, y: 0 }] }), false);
  assert.equal(Composition.isWorldCompositionV1({ ...layout, columns: 20, rows: 12 }), true);
  assert.equal(Composition.isWorldCompositionV1({ ...layout, columns: 0, rows: 12 }), false);
  assert.equal(Composition.isWorldCompositionV1({ ...layout, note: 'extra' }), false);
  assert.deepEqual(Composition.compositionSpan(layout, 8, 8), { columns: 8, rows: 8 });
  assert.deepEqual(Composition.compositionSpan({ ...layout, columns: 20, rows: 12 }, 8, 8), { columns: 20, rows: 12 });
});

test('validates footprints, required semantic metadata and relative interaction point data', () => {
  assert.deepEqual(Composition.validateComposition(layout, definition), { ok: true });
  const malformed = structuredClone(definition);
  malformed.objects.lab.interactionSlots[0].capacity = 0;
  assert.equal(Composition.validateComposition(layout, malformed).ok, false);
  const malformedPoint = structuredClone(definition);
  malformedPoint.objects.lab.interactionPoints.entrance.x = 1.5;
  assert.equal(Composition.validateComposition(layout, malformedPoint).ok, false);
});

test('rejects unknown object ids, out-of-bounds footprints and overlapping placements', () => {
  assert.equal(Composition.validateComposition({ ...layout, placements: [{ id: 'x', definitionId: 'missing', x: 1, y: 1 }] }, definition).ok, false);
  assert.equal(Composition.validateComposition({ ...layout, placements: [{ id: 'x', definitionId: 'lab', x: 7, y: 7 }] }, definition).ok, false);
  assert.equal(Composition.validateComposition({ ...layout, placements: [
    ...layout.placements,
    { id: 'rock-1', definitionId: 'rock', x: 3, y: 3 }
  ] }, definition).ok, false);
});

test('place, move, remove and terrain-paint commands produce independent valid snapshots', () => {
  const placed = Composition.applyCompositionCommand(state(), {
    type: 'place-object', placement: { id: 'rock-1', definitionId: 'rock', x: 6, y: 6 }
  }, definition);
  assert.equal(placed.ok, true);
  assert.deepEqual(placed.state.present.placements.at(-1), { id: 'rock-1', definitionId: 'rock', x: 6, y: 6 });
  const moved = Composition.applyCompositionCommand(placed.state, {
    type: 'move-object', placementId: 'lab-1', x: 0, y: 0
  }, definition);
  assert.equal(moved.ok, true);
  assert.deepEqual(moved.state.present.placements[0], { id: 'lab-1', definitionId: 'lab', x: 0, y: 0 });
  const painted = Composition.applyCompositionCommand(moved.state, {
    type: 'paint-terrain', x: 2, y: 3, terrainId: 'path'
  }, definition);
  assert.equal(painted.ok, true);
  assert.deepEqual(painted.state.present.terrain, [
    { x: 3, y: 4, terrainId: 'training-grass' },
    { x: 2, y: 3, terrainId: 'path' }
  ]);
  const removed = Composition.applyCompositionCommand(placed.state, {
    type: 'remove-object', placementId: 'rock-1'
  }, definition);
  assert.equal(removed.ok, true);
  assert.deepEqual(removed.state.present.placements, layout.placements);
});

test('invalid edits reject atomically and preserve the original editor state', () => {
  const before = state();
  const result = Composition.applyCompositionCommand(before, {
    type: 'place-object', placement: { id: 'rock-1', definitionId: 'rock', x: 3, y: 3 }
  }, definition);
  assert.equal(result.ok, false);
  assert.equal(result.state, before);
  assert.deepEqual(before.present, layout);
});

test('required semantic structures move with their stable anchor and authored interaction points', () => {
  const moved = Composition.applyCompositionCommand(state(), {
    type: 'move-object', placementId: 'lab-1', x: 4, y: 1
  }, definition);
  assert.equal(moved.ok, true);
  assert.deepEqual(Composition.resolveRelativePoint(moved.state.present.placements[0], definition.objects.lab.semanticAnchors.professor), { x: 5, y: 2 });
  assert.deepEqual(Composition.resolveRelativePoint(moved.state.present.placements[0], definition.objects.lab.interactionPoints.entrance), { x: 5, y: 3 });
  assert.deepEqual(Composition.resolveRelativePoint(moved.state.present.placements[0], definition.objects.lab.interactionPoints.work), { x: 6, y: 2 });
  const rejected = Composition.applyCompositionCommand(moved.state, { type: 'remove-object', placementId: 'lab-1' }, definition);
  assert.equal(rejected.ok, false);
});

test('resize-map grows the city and refuses a span that would clip what is already placed', () => {
  const grown = Composition.applyCompositionCommand(state(), { type: 'resize-map', columns: 20, rows: 12 }, definition);
  assert.equal(grown.ok, true);
  assert.equal(grown.state.present.columns, 20);
  assert.equal(grown.state.present.rows, 12);
  const placed = Composition.applyCompositionCommand(grown.state, {
    type: 'place-object', placement: { id: 'rock-far', definitionId: 'rock', x: 18, y: 10 }
  }, definition);
  assert.equal(placed.ok, true);
  const painted = Composition.applyCompositionCommand(placed.state, {
    type: 'paint-terrain', x: 19, y: 11, terrainId: 'path'
  }, definition);
  assert.equal(painted.ok, true);
  const clipped = Composition.applyCompositionCommand(painted.state, { type: 'resize-map', columns: 8, rows: 8 }, definition);
  assert.equal(clipped.ok, false);
  assert.equal(clipped.state, painted.state);
  const undone = Composition.undoComposition(grown.state);
  assert.equal(undone.present.columns, undefined);
  assert.equal(Composition.topPlacementAt(placed.state.present, definition, 18, 10).id, 'rock-far');
  assert.equal(Composition.placementFits(grown.state.present, definition, 'rock', 18, 10), true);
  assert.equal(Composition.placementFits(state().present, definition, 'rock', 18, 10), false);
});

test('undo restores the previous immutable layout snapshot', () => {
  const edited = Composition.applyCompositionCommand(state(), {
    type: 'paint-terrain', x: 5, y: 5, terrainId: 'path'
  }, definition);
  assert.equal(edited.ok, true);
  const undone = Composition.undoComposition(edited.state);
  assert.deepEqual(undone.present, layout);
  assert.deepEqual(undone.past, []);
  assert.deepEqual(layout.terrain, [{ x: 3, y: 4, terrainId: 'training-grass' }]);
});

