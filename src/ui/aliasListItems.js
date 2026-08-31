// Pulled out of Aliases.jsx's list mode, same reason buildBrowseItems was
// pulled out of Play.jsx: plain logic with no JSX, testable without a real
// TTY. Only the alias rows themselves — the divider and the static
// "+ New.../Back" rows stay in the component, since they're never part of
// the aligned columns.
import { sortByRecency } from './sortByRecency.js';
import { alignColumns } from './alignColumns.js';

// Songs then artists (most-specific first, mirrors Play's browse list),
// most-recently-touched first within each chunk. "token → value (type)" is
// columnar-aligned across both chunks together, same as Play's browse
// list — a song row and an artist row line up under each other exactly like
// two rows of the same kind would.
export function buildAliasListItems(aliases) {
  const songAliases = sortByRecency(aliases.filter((alias) => alias.type === 'song'));
  const artistAliases = sortByRecency(aliases.filter((alias) => alias.type === 'artist'));
  const rows = [
    ...songAliases.map((alias) => ({ token: alias.token, value: alias.title, type: 'song' })),
    ...artistAliases.map((alias) => ({ token: alias.token, value: alias.value, type: 'artist' })),
  ];
  const columns = alignColumns(rows.map((row) => [row.token, '→', row.value, `(${row.type})`]));
  return rows.map((row, i) => ({ label: columns[i].join('  '), value: row.token }));
}
