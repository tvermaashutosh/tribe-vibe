// Every token is classified independently of position — order must never matter.
// Playlist aliases are checked before artist/song aliases so a playlist token
// always wins if a name were ever reused (the global uniqueness rule normally
// prevents that collision from existing in the first place). Nothing here is
// reserved — every token is either a real alias/playlist name, or free text.
export function classifyTokens(tokens, { aliasRepo, playlistRepo, matchPlaylistTokens = true }) {
  const classifiedTokens = tokens.map((rawToken) => {
    const playlistMatch = matchPlaylistTokens ? playlistRepo.resolveToken(rawToken) : null;
    const aliasMatch = playlistMatch ? null : aliasRepo.resolveToken(rawToken);
    return {
      token: rawToken,
      match: playlistMatch ?? aliasMatch,
    };
  });
  const hasFreeText = classifiedTokens.some(({ match }) => !match);
  const aliasMatches = [];
  const freeText = [];

  for (const { token, match } of classifiedTokens) {
    // A pinned song alias is deterministic when the input consists only of
    // aliases/modifiers. In a longer phrase, preserve its spelling as part
    // of the search query instead of letting it hijack the user's search.
    if (!match || (hasFreeText && match.type === 'song')) {
      freeText.push(token);
    } else {
      aliasMatches.push({ ...match, token });
    }
  }

  return { aliasMatches, freeText };
}
