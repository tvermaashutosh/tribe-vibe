// One flat token namespace across artist aliases, song aliases, and playlist
// aliases combined — a token can never mean two different things, which is
// what keeps the classifier's resolution deterministic without extra context.
export class TokenRegistry {
  constructor(aliasRepo, playlistRepo) {
    this.aliasRepo = aliasRepo;
    this.playlistRepo = playlistRepo;
  }

  isTaken(token) {
    const normalized = token.toLowerCase();
    return Boolean(this.aliasRepo.resolveToken(normalized) || this.playlistRepo.resolveToken(normalized));
  }
}
