// The actual skip-a-divider-in-either-direction logic, pulled out of
// SkipList.jsx as plain functions so it's testable without needing to render
// an Ink component (which needs a real TTY) — the wrap-around and
// skip-direction cases are exactly where a bug would hide.
//
// `skipDefault: true` is a separate, weaker flag than `divider`: an item
// carrying it (e.g. AliasScreen/Playlists' own "+ New ..." row, now pinned
// above the real list) is still fully reachable by arrow keys and selectable
// by enter — moveSelection never looks at this flag at all — it's only
// passed over when picking where the list opens. Falls back to the plain
// first-non-divider item when every item is skipDefault (or divider), e.g.
// an empty list where "+ New ..." is the only real choice to land on.
export function findFirstSelectable(items) {
  const preferred = items.findIndex((item) => !item.divider && !item.skipDefault);
  if (preferred !== -1) return preferred;
  return Math.max(
    items.findIndex((item) => !item.divider),
    0,
  );
}

export function moveSelection(items, from, direction) {
  let index = from;
  for (let step = 0; step < items.length; step += 1) {
    index = (index + direction + items.length) % items.length;
    if (!items[index].divider) return index;
  }
  return from;
}
