export interface TableCell {
  id: string;
  row: number;
  column: number;
  rowSpan?: number;
  columnSpan?: number;
  value?: string;
}

export interface TableModelOptions {
  maxRows?: number;
  maxColumns?: number;
  maxCells?: number;
}

export interface TableModel {
  readonly rowCount: number;
  readonly columnCount: number;
  cells(): TableCell[];
  cellAt(row: number, column: number): TableCell | undefined;
  addCell(cell: TableCell): void;
  moveCell(id: string, row: number, column: number): void;
  resizeCell(id: string, rowSpan: number, columnSpan: number): void;
  removeCell(id: string): boolean;
}

const MAX_ROWS = 10_000;
const MAX_COLUMNS = 10_000;
const MAX_CELLS = 100_000;

function limit(value: number | undefined, maximum: number, name: string): number {
  const result = value ?? maximum;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    throw new RangeError(`${name} must be an integer from 1 to ${maximum}.`);
  }
  return result;
}

function integer(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(`${name} must be a nonnegative integer.`);
}

function copyCell(cell: TableCell): TableCell {
  if (!cell || typeof cell !== 'object') throw new TypeError('A cell is required.');
  if (typeof cell.id !== 'string' || !cell.id.trim() || cell.id.length > 128) {
    throw new TypeError('Cell ID must be a nonempty string up to 128 characters.');
  }
  integer(cell.row, 'row');
  integer(cell.column, 'column');
  const rowSpan = cell.rowSpan ?? 1;
  const columnSpan = cell.columnSpan ?? 1;
  if (!Number.isSafeInteger(rowSpan) || rowSpan < 1)
    throw new RangeError('rowSpan must be positive.');
  if (!Number.isSafeInteger(columnSpan) || columnSpan < 1)
    throw new RangeError('columnSpan must be positive.');
  if (cell.value !== undefined && typeof cell.value !== 'string') {
    throw new TypeError('Cell value must be text.');
  }
  return Object.freeze({
    id: cell.id,
    row: cell.row,
    column: cell.column,
    rowSpan,
    columnSpan,
    ...(cell.value === undefined ? {} : { value: cell.value }),
  });
}

export function createTableModel(
  rowCount: number,
  columnCount: number,
  initialCells: Iterable<TableCell> = [],
  options: TableModelOptions = {},
): TableModel {
  const maxRows = limit(options.maxRows, MAX_ROWS, 'maxRows');
  const maxColumns = limit(options.maxColumns, MAX_COLUMNS, 'maxColumns');
  const maxCells = limit(options.maxCells, MAX_CELLS, 'maxCells');
  if (!Number.isSafeInteger(rowCount) || rowCount < 1 || rowCount > maxRows) {
    throw new RangeError(`rowCount must be an integer from 1 to ${maxRows}.`);
  }
  if (!Number.isSafeInteger(columnCount) || columnCount < 1 || columnCount > maxColumns) {
    throw new RangeError(`columnCount must be an integer from 1 to ${maxColumns}.`);
  }
  if (initialCells == null || typeof initialCells[Symbol.iterator] !== 'function') {
    throw new TypeError('Initial cells must be iterable.');
  }
  let cells: TableCell[] = [];

  const validate = (candidate: TableCell[]): void => {
    if (candidate.length > maxCells) throw new RangeError('Cell capacity exceeded.');
    const ids = new Set<string>();
    const columnEdges = new Set<number>();
    for (const cell of candidate) {
      if (cell.row + cell.rowSpan! > rowCount || cell.column + cell.columnSpan! > columnCount) {
        throw new RangeError(`Cell ${cell.id} exceeds table dimensions.`);
      }
      if (ids.has(cell.id)) throw new TypeError(`Duplicate cell ID: ${cell.id}`);
      ids.add(cell.id);
      columnEdges.add(cell.column);
      columnEdges.add(cell.column + cell.columnSpan!);
    }
    if (candidate.length < 2) return;

    const edges = [...columnEdges].sort((a, b) => a - b);
    const edgeIndex = new Map(edges.map((edge, index) => [edge, index]));
    const events = candidate.flatMap((cell) => [
      { row: cell.row, delta: 1, cell },
      { row: cell.row + cell.rowSpan!, delta: -1, cell },
    ]);
    events.sort((first, second) => first.row - second.row || first.delta - second.delta);

    const segmentCount = edges.length - 1;
    const maximum = new Array<number>(segmentCount * 4).fill(0);
    const lazy = new Array<number>(segmentCount * 4).fill(0);
    const apply = (node: number, delta: number): void => {
      maximum[node] = maximum[node]! + delta;
      lazy[node] = lazy[node]! + delta;
    };
    const push = (node: number): void => {
      if (lazy[node] === 0) return;
      apply(node * 2, lazy[node]!);
      apply(node * 2 + 1, lazy[node]!);
      lazy[node] = 0;
    };
    const update = (
      node: number,
      left: number,
      right: number,
      queryLeft: number,
      queryRight: number,
      delta: number,
    ): void => {
      if (queryLeft <= left && right <= queryRight) {
        apply(node, delta);
        return;
      }
      push(node);
      const middle = Math.floor((left + right) / 2);
      if (queryLeft <= middle) {
        update(node * 2, left, middle, queryLeft, queryRight, delta);
      }
      if (queryRight > middle) {
        update(node * 2 + 1, middle + 1, right, queryLeft, queryRight, delta);
      }
      maximum[node] = Math.max(maximum[node * 2]!, maximum[node * 2 + 1]!);
    };
    const queryMaximum = (
      node: number,
      left: number,
      right: number,
      queryLeft: number,
      queryRight: number,
    ): number => {
      if (queryLeft <= left && right <= queryRight) return maximum[node]!;
      push(node);
      const middle = Math.floor((left + right) / 2);
      let result = 0;
      if (queryLeft <= middle) {
        result = queryMaximum(node * 2, left, middle, queryLeft, queryRight);
      }
      if (queryRight > middle) {
        result = Math.max(
          result,
          queryMaximum(node * 2 + 1, middle + 1, right, queryLeft, queryRight),
        );
      }
      return result;
    };

    for (const event of events) {
      const left = edgeIndex.get(event.cell.column)!;
      const right = edgeIndex.get(event.cell.column + event.cell.columnSpan!)! - 1;
      if (event.delta < 0) {
        update(1, 0, segmentCount - 1, left, right, -1);
      } else {
        if (queryMaximum(1, 0, segmentCount - 1, left, right) > 0) {
          throw new RangeError(`Cell ${event.cell.id} overlaps another cell.`);
        }
        update(1, 0, segmentCount - 1, left, right, 1);
      }
    }
  };

  for (const inputCell of initialCells) {
    if (cells.length >= maxCells) throw new RangeError('Cell capacity exceeded.');
    const cell = copyCell(inputCell);
    cells.push(cell);
  }
  validate(cells);

  const requireCell = (id: string): TableCell => {
    const cell = cells.find((item) => item.id === id);
    if (!cell) throw new TypeError(`Unknown cell ID: ${id}`);
    return cell;
  };

  return {
    rowCount,
    columnCount,
    cells() {
      return cells.map((cell) => ({ ...cell }));
    },
    cellAt(row, column) {
      integer(row, 'row');
      integer(column, 'column');
      if (row >= rowCount || column >= columnCount) return undefined;
      const cell = cells.find(
        (item) =>
          row >= item.row &&
          row < item.row + item.rowSpan! &&
          column >= item.column &&
          column < item.column + item.columnSpan!,
      );
      return cell ? { ...cell } : undefined;
    },
    addCell(inputCell) {
      const cell = copyCell(inputCell);
      const candidate = [...cells, cell];
      validate(candidate);
      cells = candidate;
    },
    moveCell(id, row, column) {
      integer(row, 'row');
      integer(column, 'column');
      const previous = requireCell(id);
      const candidate = cells.map((cell) =>
        cell.id === id ? copyCell({ ...cell, row, column }) : cell,
      );
      validate(candidate);
      if (!previous) throw new TypeError(`Unknown cell ID: ${id}`);
      cells = candidate;
    },
    resizeCell(id, rowSpan, columnSpan) {
      const previous = requireCell(id);
      const candidate = cells.map((cell) =>
        cell.id === id ? copyCell({ ...cell, rowSpan, columnSpan }) : cell,
      );
      validate(candidate);
      if (!previous) throw new TypeError(`Unknown cell ID: ${id}`);
      cells = candidate;
    },
    removeCell(id) {
      const index = cells.findIndex((cell) => cell.id === id);
      if (index < 0) return false;
      cells = cells.filter((cell) => cell.id !== id);
      return true;
    },
  };
}
