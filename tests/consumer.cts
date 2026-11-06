import api = require('@lp-labs/table-model');

const table = api.createTableModel(1, 1);
table.addCell({ id: 'cell', row: 0, column: 0 });
console.log(table.cellAt(0, 0)?.id);
