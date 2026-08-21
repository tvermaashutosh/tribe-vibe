import { normalizeArgs } from './normalize.js';
import { extractLoopFlag } from './flags.js';
import { classifyTokens } from './classify.js';
import { buildIntent } from './resolve.js';

// The whole pipeline, as a chain of pure stages:
// normalize -> extract the -l/-loop flag -> classify -> resolve.
export function resolveIntent(rawArgs, { aliasRepo, playlistRepo }) {
  const tokens = normalizeArgs(rawArgs);
  const { loop, remaining } = extractLoopFlag(tokens);
  const classified = classifyTokens(remaining, { aliasRepo, playlistRepo });
  return buildIntent({ ...classified, modifiers: { loop } });
}

const LITERAL_QUERY_RE = /^-(q|query)$/i;

// The single entry point for "resolve one line of typed input" — used
// identically by the typed CLI and every Ink screen that offers a text box
// with this grammar (Play, and playlist add/replace-song). If the line
// starts with -q/-query, everything after that token is a literal search —
// no alias resolution, no modifiers — otherwise it's the normal
// alias-aware resolveIntent above. Keeping this in one place is what makes
// "-q works the same everywhere" true by construction rather than by
// remembering to copy the check into every screen that has a text box.
export function resolveTypedInput(text, { aliasRepo, playlistRepo }) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { kind: 'empty', deterministic: false, modifiers: {} };

  if (LITERAL_QUERY_RE.test(tokens[0])) {
    const query = tokens.slice(1).join(' ');
    if (!query) return { kind: 'empty', deterministic: false, modifiers: {} };
    return { kind: 'search', deterministic: false, query, modifiers: {} };
  }

  return resolveIntent(tokens, { aliasRepo, playlistRepo });
}
