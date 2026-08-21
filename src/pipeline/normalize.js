// Whitespace around `=` must never matter: `loop = 10`, `loop= 10`, `loop =10`,
// and `loop=10` all need to collapse to one token before classification —
// otherwise the shell hands us ["loop", "=", "10"] as three separate tokens.
export function normalizeArgs(rawArgs) {
  const joined = rawArgs.join(' ');
  const collapsed = joined.replace(/\s*=\s*/g, '=');
  return collapsed.split(/\s+/).filter(Boolean);
}
