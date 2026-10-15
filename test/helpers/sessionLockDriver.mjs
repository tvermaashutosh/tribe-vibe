import { acquireSessionLock, releaseSessionLock } from '../../src/repository/sessionLock.js';

const platform = { getConfigDir: () => process.argv[2] };
const lease = acquireSessionLock(platform);
process.stdout.write(`${JSON.stringify({ acquired: Boolean(lease), pid: process.pid })}\n`);

process.stdin.once('data', () => {
  if (lease) releaseSessionLock(platform, lease);
  process.exit(0);
});
process.stdin.resume();
