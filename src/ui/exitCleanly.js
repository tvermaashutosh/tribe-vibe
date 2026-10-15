import { releaseSessionLock } from '../repository/sessionLock.js';

// process.exit() terminates immediately, so UI-driven exits must release
// their own lease instead of relying on cli.js's finally block. Requiring
// the lease also ensures a menu that lost the lock cannot release another
// terminal's active session.
export function exitCleanly(platform, code = 0, sessionLock) {
  releaseSessionLock(platform, sessionLock);
  process.exit(code);
}
