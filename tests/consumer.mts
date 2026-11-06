import { createTableModel, type TableCell } from '@lp-labs/table-model';

const initial: TableCell[] = [{ id: 'cell', row: 0, column: 0, value: 'text' }];
const table = createTableModel(2, 2, initial);
table.resizeCell('cell', 1, 2);
const result: TableCell | undefined = table.cellAt(0, 1);
console.log(result?.id);
