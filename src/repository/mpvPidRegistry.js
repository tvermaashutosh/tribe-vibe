import fs from 'node:fs';
import path from 'node:path';

function registryPath(platform) {
  return path.join(platform.getConfigDir(), '.mpv-pids.json');
}

function readPids(platform) {
  try {
    const parsed = JSON.parse(fs.readFileSync(registryPath(platform), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePids(platform, pids) {
  try {
    fs.mkdirSync(platform.getConfigDir(), { recursive: true });
    fs.writeFileSync(registryPath(platform), JSON.stringify(pids));
  } catch {
    // Best-effort only — worst case, -kill just has one fewer PID to find
    // next time. Never worth failing an actual play over.
  }
}

// Every mpv process tribe-vibe itself ever spawns — foreground plays and the
// background daemon alike — gets recorded here. This is how -kill finds
// exactly its own processes later, rather than pattern-matching `ps` output
// by command-line text: the wrong scope of pattern can match a totally
// unrelated process on the same machine (confirmed the hard way earlier in
// this project's own history), where a tracked, real PID never can.
export function recordMpvPid(platform, pid) {
  const pids = readPids(platform);
  if (!pids.includes(pid)) pids.push(pid);
  writePids(platform, pids);
}

// Called on a foreground mpv's own normal exit, so the registry doesn't grow
// unbounded across ordinary, uneventful plays — killAllTrackedMpv below
// self-heals against whatever this misses anyway (a crash, or the exact
// orphaned-after-terminal-closed case this whole file exists for).
export function removeMpvPid(platform, pid) {
  writePids(platform, readPids(platform).filter((existing) => existing !== pid));
}

// The rescue command: every tracked PID gets SIGTERM, whether or not it's
// still alive — a PID that's already gone just fails harmlessly and is
// reported as such. The registry is cleared unconditionally afterward, so a
// stale entry never lingers past this even if something couldn't be killed.
export function killAllTrackedMpv(platform) {
  const pids = readPids(platform);
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
  writePids(platform, []);
  return { killed, alreadyGone };
}
