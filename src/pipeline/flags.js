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

// -q / -query (or --q / --query) — same order-independent extraction as
// -l/-loop above, not the fixed-first-token check this used to be. Unlike
// -l, it carries no value of its own: its only job is to flip how whatever
// tokens remain get interpreted downstream (literal search text instead of
// alias-resolved) — extracting it here, at the same priority tier as -l,
// is what makes -l stay composable with it (a bare "-q -l" used to silently
// swallow -l as part of the literal text and drop the loop modifier
// entirely, since the old check bypassed loop extraction altogether).
const LITERAL_QUERY_FLAG_RE = /^--?(q|query)$/i;

export function extractLiteralQueryFlag(tokens) {
  let literal = false;
  const remaining = [];
  for (const token of tokens) {
    if (LITERAL_QUERY_FLAG_RE.test(token)) literal = true;
    else remaining.push(token);
  }
  return { literal, remaining };
}
