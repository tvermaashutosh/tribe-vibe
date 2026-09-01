// Pulled out of AliasScreen.jsx's list mode, same reason buildBrowseItems
// was pulled out of Play.jsx: plain logic with no JSX, testable without a
// real TTY. Only the alias rows themselves — the divider and the static
// "+ New.../Back" rows stay in the component, since they're never part of
// the aligned columns.
import { sortByRecency } from './sortByRecency.js';
import { alignColumns } from './alignColumns.js';

// AliasScreen.jsx passes in only one type's aliases at a time (Songs or
// Artists is a whole separate screen now) — so there's no "(type)" suffix
// column here the way Play's mixed browse list needs one: every row on this
// screen is already the same kind, so repeating it on every line would be
// pure noise. Just "token → value", most-recently-touched first, matching
// Playlists.jsx's own list.
export function buildAliasListItems(aliases) {
  const rows = sortByRecency(aliases).map((alias) => ({
    token: alias.token,
    value: alias.type === 'artist' ? alias.value : alias.title,
  }));
  const columns = alignColumns(rows.map((row) => [row.token, '→', row.value]));
  return rows.map((row, i) => ({ label: columns[i].join('  '), value: row.token }));
}
