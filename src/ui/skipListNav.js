// The actual skip-a-divider-in-either-direction logic, pulled out of
// SkipList.jsx as plain functions so it's testable without needing to render
// an Ink component (which needs a real TTY) — the wrap-around and
// skip-direction cases are exactly where a bug would hide.
export function findFirstSelectable(items) {
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
