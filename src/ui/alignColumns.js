// Given rows of column values (not yet padded), pads every column except the
// last to the width of its longest value across all rows — so the same kind
// of value starts at the same left position in every row, and whatever
// follows a padded column (the next column's own first character) lines up
// too. A column's width only ever grows to fit its longest value, never
// shrinks to cut a shorter — or longer — one off, so nothing is ever
// truncated. The last column is left exactly as-is: padding it would only
// add invisible trailing whitespace, since nothing renders after it.
export function alignColumns(rows) {
  if (rows.length === 0) return [];
  const columnCount = rows[0].length;
  const paddedColumnCount = columnCount - 1;
  const widths = new Array(paddedColumnCount).fill(0);
  for (const row of rows) {
    for (let i = 0; i < paddedColumnCount; i += 1) widths[i] = Math.max(widths[i], row[i].length);
  }
  return rows.map((row) => row.map((value, i) => (i < paddedColumnCount ? value.padEnd(widths[i]) : value)));
}
