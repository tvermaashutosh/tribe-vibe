// Pure sort, no JSX, so it's testable without a real TTY. Most-recently-
// touched first (creation counts as a touch, same as any later edit) — an
// entry written before `updatedAt` existed has no value for it and falls to
// the bottom of its chunk via the ?? 0 fallback, rather than sorting
// unpredictably or crashing.
export function sortByRecency(items) {
  return [...items].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
