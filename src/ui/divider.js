// A visual separator row for screens that stack an existing-items list above
// static action items (AliasScreen, Playlists, etc.) — rendered via SkipList.jsx,
// which treats any item with `divider: true` as structurally unselectable:
// arrow navigation skips straight over it, and it can never reach onSelect.
export const DIVIDER_ITEM = { label: '─'.repeat(30), value: '__divider__', divider: true };
