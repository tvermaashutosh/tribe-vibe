// One flat token namespace across artist aliases, song aliases, and playlist
// aliases combined — a token can never mean two different things, which is
// what keeps the classifier's resolution deterministic without extra context.
const TAKEN_AS_LABEL = {
  artist: 'an artist alias',
  song: 'a song alias',
  playlist: 'a playlist name',
};

export class TokenRegistry {
  constructor(aliasRepo, playlistRepo) {
    this.aliasRepo = aliasRepo;
    this.playlistRepo = playlistRepo;
  }

  isTaken(token) {
    return Boolean(this.resolve(token));
  }

  resolve(token) {
    const normalized = token.toLowerCase();
    return this.aliasRepo.resolveToken(normalized) || this.playlistRepo.resolveToken(normalized);
  }

  // What the token is already taken as, in words fit for an error message —
  // null when it's free. Keeps every collision message honest about which
  // kind of thing it's colliding with, instead of leaving the user to guess.
  describeTaken(token) {
    const match = this.resolve(token);
    return match ? TAKEN_AS_LABEL[match.type] : null;
  }
}
