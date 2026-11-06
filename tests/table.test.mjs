import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createTableModel } from '../dist/esm/index.js';

test('spans occupy their complete rectangular area', () => {
  const table = createTableModel(3, 4, [
    {
      id: 'merged',
      row: 0,
      column: 0,
      rowSpan: 2,
      columnSpan: 3,
      value: 'header',
    },
    { id: 'edge', row: 2, column: 3, value: 'last' },
  ]);
  assert.equal(table.cellAt(1, 2).id, 'merged');
  assert.equal(table.cellAt(0, 3), undefined);
  assert.equal(table.cellAt(2, 3).value, 'last');
  assert.equal(table.cellAt(3, 0), undefined);
});

test('constructor rejects overlaps and out-of-bounds spans', () => {
  assert.throws(
    () =>
      createTableModel(2, 2, [
        { id: 'a', row: 0, column: 0, rowSpan: 2 },
        { id: 'b', row: 1, column: 0 },
      ]),
    /overlaps/,
  );
  assert.throws(
    () => createTableModel(2, 2, [{ id: 'a', row: 1, column: 1, columnSpan: 2 }]),
    /exceeds/,
  );
});

test('failed add is atomic and leaves every existing cell intact', () => {
  const table = createTableModel(2, 2, [{ id: 'a', row: 0, column: 0, value: 'old' }]);
  assert.throws(() => table.addCell({ id: 'b', row: 0, column: 0 }), /overlaps/);
  assert.throws(() => table.addCell({ id: 'b', row: 2, column: 0 }), /exceeds/);
  assert.deepEqual(table.cells(), [
    { id: 'a', row: 0, column: 0, rowSpan: 1, columnSpan: 1, value: 'old' },
  ]);
});

test('move and resize operations validate before committing', () => {
  const table = createTableModel(3, 3, [
    { id: 'a', row: 0, column: 0, rowSpan: 2, columnSpan: 2 },
    { id: 'b', row: 2, column: 2 },
  ]);
  const before = table.cells();
  assert.throws(() => table.moveCell('b', 1, 1), /overlaps/);
  assert.deepEqual(table.cells(), before);
  assert.throws(() => table.resizeCell('a', 3, 3), /overlaps/);
  assert.deepEqual(table.cells(), before);
  table.moveCell('b', 2, 1);
  assert.equal(table.cellAt(2, 1).id, 'b');
});

test('ids, values, dimensions, and limits are validated', () => {
  assert.throws(() => createTableModel(0, 2), /rowCount/);
  assert.throws(() => createTableModel(2, 0), /columnCount/);
  assert.throws(() => createTableModel(2, 2, [{ id: '', row: 0, column: 0 }]), TypeError);
  assert.throws(() => createTableModel(2, 2, [{ id: 'x', row: 0, column: 0, value: 1 }]), /text/);
  assert.throws(
    () =>
      createTableModel(2, 2, [
        { id: 'x', row: 0, column: 0 },
        { id: 'x', row: 1, column: 1 },
      ]),
    /Duplicate/,
  );
  assert.throws(() => createTableModel(2, 2, [], { maxCells: 0 }), /maxCells/);
  const limited = createTableModel(1, 2, [], { maxCells: 1 });
  limited.addCell({ id: 'first', row: 0, column: 0 });
  assert.throws(() => limited.addCell({ id: 'second', row: 0, column: 1 }), /capacity/);
  assert.deepEqual(
    limited.cells().map((cell) => cell.id),
    ['first'],
  );
});

test('read results cannot mutate model state and removal is explicit', () => {
  const table = createTableModel(2, 2, [{ id: 'a', row: 0, column: 0 }]);
  const copy = table.cellAt(0, 0);
  copy.row = 1;
  assert.equal(table.cellAt(0, 0).id, 'a');
  assert.equal(table.removeCell('missing'), false);
  assert.equal(table.removeCell('a'), true);
  assert.equal(table.cells().length, 0);
});

test('generated nonoverlapping grid remains queryable', () => {
  const cells = [];
  for (let row = 0; row < 20; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      cells.push({
        id: `${row}:${column}`,
        row,
        column,
        value: `${row + column}`,
      });
    }
  }
  const table = createTableModel(20, 10, cells);
  for (const cell of cells) {
    assert.equal(table.cellAt(cell.row, cell.column).id, cell.id);
  }
  assert.equal(table.cells().length, 200);
});

test('generated span layouts agree with a pairwise overlap oracle', () => {
  let seed = 0x12345678;
  const random = (maximum) => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed % maximum;
  };
  for (let trial = 0; trial < 100; trial += 1) {
    const cells = Array.from({ length: 30 }, (_, index) => {
      const row = random(8);
      const column = random(8);
      const rowSpan = 1 + random(Math.min(3, 10 - row));
      const columnSpan = 1 + random(Math.min(3, 10 - column));
      return { id: `c-${index}`, row, column, rowSpan, columnSpan };
    });
    const expectedOverlap = cells.some((cell, index) =>
      cells
        .slice(0, index)
        .some(
          (other) =>
            cell.row < other.row + other.rowSpan &&
            other.row < cell.row + cell.rowSpan &&
            cell.column < other.column + other.columnSpan &&
            other.column < cell.column + cell.columnSpan,
        ),
    );
    if (expectedOverlap) {
      assert.throws(() => createTableModel(10, 10, cells), /overlaps/);
    } else {
      assert.equal(createTableModel(10, 10, cells).cells().length, cells.length);
    }
  }
});

test('CommonJS entry point creates a working table', () => {
  const api = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.equal(api.createTableModel(1, 1).rowCount, 1);
});
