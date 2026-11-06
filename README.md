# @lp-labs/table-model

A small validated table occupancy model. Cells are rectangular spans; any overlap or out-of-range
operation is rejected before the existing table state changes.

## Install

```sh
npm install @lp-labs/table-model
```

```js
import { createTableModel } from '@lp-labs/table-model';

const table = createTableModel(3, 4, [
  {
    id: 'title',
    row: 0,
    column: 0,
    rowSpan: 1,
    columnSpan: 3,
    value: 'Quarterly report',
  },
  { id: 'amount', row: 1, column: 0, value: '42' },
]);
console.log(table.cellAt(0, 2)); // the spanning title cell
table.moveCell('amount', 2, 0);
table.resizeCell('title', 1, 4);
```

## API

- `createTableModel(rowCount, columnCount, cells?, options?)` creates a table with positive integer
  dimensions. A cell has a unique `id`, zero-based `row` and `column`, optional positive
  `rowSpan`/`columnSpan` (default 1), and optional text `value`.
- `TableModel.rowCount` and `TableModel.columnCount` expose the immutable table dimensions.
- `TableModel.cells()` returns copied cell records in insertion order.
- `TableModel.cellAt(row, column)` returns a copied occupying cell or `undefined` for an empty or
  out-of-table position.
- `TableModel.addCell(cell)`, `moveCell(id, row, column)`, and `resizeCell(id, rowSpan, columnSpan)`
  validate the complete candidate layout before committing. A failure leaves every cell unchanged.
- `TableModel.removeCell(id)` returns `true` when removed and `false` when absent.
- `TableCell`, `TableModel`, and `TableModelOptions` are exported types.

Options `maxRows`, `maxColumns`, and `maxCells` default to 10,000, 10,000, and 100,000 and may only
lower those limits. Coordinates are zero-based. The model stores plain text values, not formulas,
styles, row/column metadata, or rendered HTML.

Invalid IDs, dimensions, spans, values, duplicates, overlaps, and capacity violations throw
`TypeError` or `RangeError`; unknown IDs for move/resize throw `TypeError`. Mutating methods are
atomic with respect to validation failures.

## Module formats and customization

ESM, CommonJS, and TypeScript declarations are included. For CommonJS, use
`const { createTableModel } = require('@lp-labs/table-model')`. Adapt application-specific values
to text in your own layer, or add a separately validated payload map keyed by cell ID.

There are no runtime or peer dependencies. TypeScript and Prettier are development-only.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
