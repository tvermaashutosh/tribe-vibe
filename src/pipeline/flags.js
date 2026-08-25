// -l / -loop / --l / --loop (with optional =N) is the only per-token flag
// inside a play command — extracted before classification runs, so nothing
// else is reserved: every alias/playlist token, and every free-text word, is
// typed as-is, order-independent, same as any other token. Order-independent
// too: `-loop=10 tsw tt` and `tsw tt -loop=10` resolve identically. Both
// single- and double-dash are accepted (tswift, this app's own predecessor,
// took `--loop` too — a token starting with `--` would otherwise silently
// fall through as literal search text instead of being recognized at all).
const LOOP_FLAG_RE = /^--?(l|loop)(?:=(.+))?$/i;

export function extractLoopFlag(tokens) {
  let loop;
  const remaining = [];
  for (const token of tokens) {
    const match = LOOP_FLAG_RE.exec(token);
    if (match) {
      loop = match[2] === undefined ? true : match[2];
    } else {
      remaining.push(token);
    }
  }
  return { loop, remaining };
}
