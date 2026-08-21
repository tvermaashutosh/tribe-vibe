// Builds the final play intent from classified tokens. This is where the
// deterministic-vs-ambiguous split happens:
//   - a playlist or song alias match is a pinned videoId -> fully deterministic,
//     no search, no picker, ever.
//   - anything else (artist alias + free text, or raw free text alone) is a
//     genuine search -> ambiguous, resolved later via the shared Picker.
export function buildIntent({ modifiers, aliasMatches, freeText }) {
  const playlistMatch = aliasMatches.find((match) => match.type === 'playlist');
  if (playlistMatch) {
    return {
      kind: 'playlist',
      deterministic: true,
      playlistName: playlistMatch.name,
      modifiers,
    };
  }

  const songMatch = aliasMatches.find((match) => match.type === 'song');
  if (songMatch) {
    const artistMatch = aliasMatches.find((match) => match.type === 'artist');
    const note = artistMatch
      ? `ignoring "${artistMatch.token}" — "${songMatch.token}" already resolves to "${songMatch.title}"`
      : null;
    return {
      kind: 'song',
      deterministic: true,
      videoId: songMatch.videoId,
      title: songMatch.title,
      modifiers,
      note,
    };
  }

  const artistMatch = aliasMatches.find((match) => match.type === 'artist');
  const query = [artistMatch ? artistMatch.value : null, ...freeText].filter(Boolean).join(' ');

  if (!query) {
    return { kind: 'empty', deterministic: false, modifiers };
  }

  return {
    kind: 'search',
    deterministic: false,
    query,
    modifiers,
  };
}
