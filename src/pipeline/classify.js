// Every token is classified independently of position — order must never matter.
// Playlist aliases are checked before artist/song aliases so a playlist token
// always wins if a name were ever reused (the global uniqueness rule normally
// prevents that collision from existing in the first place). Nothing here is
// reserved — every token is either a real alias/playlist name, or free text.
export function classifyTokens(tokens, { aliasRepo, playlistRepo }) {
  const aliasMatches = [];
  const freeText = [];

  for (const rawToken of tokens) {
    const playlistMatch = playlistRepo.resolveToken(rawToken);
    if (playlistMatch) {
      aliasMatches.push({ ...playlistMatch, token: rawToken });
      continue;
    }

    const aliasMatch = aliasRepo.resolveToken(rawToken);
    if (aliasMatch) {
      aliasMatches.push({ ...aliasMatch, token: rawToken });
      continue;
    }

    freeText.push(rawToken);
  }

  return { aliasMatches, freeText };
}
