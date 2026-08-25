import { normalizeArgs } from './normalize.js';
import { extractLoopFlag, extractLiteralQueryFlag } from './flags.js';
import { classifyTokens } from './classify.js';
import { buildIntent } from './resolve.js';

// The whole pipeline, as a chain of pure stages, each flag extracted from
// anywhere in the token list rather than any fixed position — order never
// matters for any single flag, matching -l/-loop's own contract. A fixed
// priority only matters where two flags could otherwise interact:
//   1. -q/-query — a mode-switch, not a value: does everything left over
//      get alias-resolved, or taken as one literal search string?
//   2. -l/-loop — a modifier, composable either way #1 goes
//   3. classify + resolve — only reached when #1 said "alias-resolve it"
export function resolveIntent(rawArgs, { aliasRepo, playlistRepo }) {
  const tokens = normalizeArgs(rawArgs);
  const { literal, remaining: afterQuery } = extractLiteralQueryFlag(tokens);
  const { loop, remaining } = extractLoopFlag(afterQuery);

  if (literal) {
    const query = remaining.join(' ');
    if (!query) return { kind: 'empty', deterministic: false, modifiers: { loop } };
    return { kind: 'search', deterministic: false, query, modifiers: { loop } };
  }

  const classified = classifyTokens(remaining, { aliasRepo, playlistRepo });
  return buildIntent({ ...classified, modifiers: { loop } });
}

// The single entry point for "resolve one line of typed input" — used
// identically by the typed CLI and every Ink screen that offers a text box
// with this grammar (Play, and playlist add/replace-song). Keeping this in
// one place is what makes "-q and -l work the same everywhere" true by
// construction rather than by remembering to copy checks into every screen
// that has a text box.
export function resolveTypedInput(text, { aliasRepo, playlistRepo }) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { kind: 'empty', deterministic: false, modifiers: {} };

  return resolveIntent(tokens, { aliasRepo, playlistRepo });
}
