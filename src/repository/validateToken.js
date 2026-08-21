// A token typed on the command line is one whitespace-delimited word — an
// alias containing a space could never actually be typed as a single token,
// so it's rejected here rather than silently becoming unreachable.
export function assertValidToken(token) {
  if (!token || !token.trim()) {
    throw new Error('Alias cannot be empty');
  }
  if (/\s/.test(token)) {
    throw new Error(`"${token}" cannot contain spaces — an alias must be a single word`);
  }
  if (token.startsWith('-')) {
    throw new Error(`"${token}" cannot start with "-" — that's reserved for CLI flags like -loop or -pause`);
  }
}
