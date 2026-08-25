import { execFileSync } from 'node:child_process';

const MPV_PROCESS_NAME = 'mpv';

// Confirmed live: pgrep -x matches on a process's own short executable name
// (argv[0]'s basename) — a real running mpv installed at
// /opt/homebrew/bin/mpv still matched `pgrep -x mpv` correctly, even though
// `ps -o comm=` shows the full resolved path for the same process. Exact-name
// matching only, never a command-line substring pattern like pkill -f — the
// wrong scope of pattern can match a totally unrelated process (confirmed
// the hard way earlier in this project's own history); matching on the
// process's own name can't.
function findPidsByExactNamePosix(name) {
  try {
    const output = execFileSync('pgrep', ['-x', name], { encoding: 'utf8' });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(Number);
  } catch (err) {
    // pgrep's own documented exit status for "nothing matched" — not a
    // real failure.
    if (err.status === 1) return [];
    throw err;
  }
}

// Unverified live (no Windows machine available in this project) — based on
// tasklist's documented CSV output: one process per line, quoted image name
// first, quoted PID second. IMAGENAME eq is an exact match on Windows too,
// same contract as pgrep -x.
function findPidsByExactNameWindows(name) {
  try {
    const output = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${name}.exe`, '/NH', '/FO', 'CSV'], { encoding: 'utf8' });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => Number(line.split(',')[1]?.replace(/"/g, '')))
      .filter((pid) => Number.isInteger(pid));
  } catch {
    return [];
  }
}

function findPidsByExactName(name) {
  return process.platform === 'win32' ? findPidsByExactNameWindows(name) : findPidsByExactNamePosix(name);
}

// Exported with the process name as a parameter (not hardcoded inside) so
// tests can target a harmless, unique fake name instead of the real 'mpv' —
// running this for real against 'mpv' would kill every mpv process on
// whatever machine runs the test suite, including one a developer has open
// for something unrelated to tribe-vibe entirely.
export function killAllByExactName(name) {
  const pids = findPidsByExactName(name);
  const killed = [];
  const alreadyGone = [];
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
      killed.push(pid);
    } catch {
      alreadyGone.push(pid);
    }
  }
  return { killed, alreadyGone };
}

// The real, production entry point for `tv -kill`: every mpv process on the
// machine, not just ones tribe-vibe itself spawned — deliberately. This
// doesn't try to distinguish an orphaned foreground play (the scenario that
// motivated it — closing a terminal can leave one running indefinitely,
// looped, with no controlling terminal and no way back in) from any other
// mpv session running for any other reason; it stops all of them.
export function killAllMpv() {
  return killAllByExactName(MPV_PROCESS_NAME);
}
