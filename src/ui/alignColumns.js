import stringWidth from 'string-width';

// Given rows of column values (not yet padded), pads every column except the
// last to the width of its longest value across all rows — so the same kind
// of value starts at the same left position in every row, and whatever
// follows a padded column (the next column's own first character) lines up
// too. A column's width only ever grows to fit its longest value, never
// shrinks to cut a shorter — or longer — one off, so nothing is ever
// truncated. The last column is left exactly as-is: padding it would only
// add invisible trailing whitespace, since nothing renders after it.
//
// Widths are measured with string-width, not .length — a CJK character (or
// an emoji) renders as 2 terminal columns but is only 1 (or 2, for a
// surrogate pair) in JS string length, so padEnd()-ing on raw .length
// under-pads any row containing one, throwing the very next column out of
// alignment. Confirmed live: a '뚜두뚜두' alias title left its row's "(song)"
// visibly shifted left of every other row's until this fix.
export function alignColumns(rows) {
  if (rows.length === 0) return [];
  const columnCount = rows[0].length;
  const paddedColumnCount = columnCount - 1;
  const widths = new Array(paddedColumnCount).fill(0);
  for (const row of rows) {
    for (let i = 0; i < paddedColumnCount; i += 1) widths[i] = Math.max(widths[i], stringWidth(row[i]));
  }
  return rows.map((row) => row.map((value, i) => {
    if (i >= paddedColumnCount) return value;
    const gap = widths[i] - stringWidth(value);
    return gap > 0 ? value + ' '.repeat(gap) : value;
  }));
}
