import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { MpvDaemonSupervisor } from '../player/mpvDaemonSupervisor.js';

// Runs a fixed set of read-only checks and returns plain results — no
// commands are ever executed on the user's behalf. Each check reports a
// copy-pasteable fix instead, since deciding to run brew/pipx/etc. is a call
// only the user should make.
function run(command, args) {
  return new Promise((resolve) => {
    const proc = spawn(command, args);
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    proc.on('error', () => resolve({ code: null, stdout, stderr }));
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// Scans PATH directly rather than relying on `which -a` (not present on
// Windows, and this stays consistent across all three platforms).
export function findAllOnPath(binaryName) {
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const executableName = process.platform === 'win32' ? `${binaryName}.exe` : binaryName;
  const found = [];
  for (const dir of pathDirs) {
    const candidate = path.join(dir, executableName);
    if (fs.existsSync(candidate)) found.push(candidate);
  }
  return found;
}

// yt-dlp's own -U output — parsed even when it exits non-zero (a
// pip/brew-managed install refuses to self-update but still prints both
// version lines first, which is exactly what's useful here).
export function parseUpdateOutput(output) {
  const currentMatch = output.match(/Current version:\s*(?:stable@)?(\S+)/i);
  const latestMatch = output.match(/Latest version:\s*(?:stable@)?(\S+)/i);
  const blockedBySelfUpdateGuard = /installed .* with pip|wheel from PyPi/i.test(output);
  return {
    current: currentMatch ? currentMatch[1] : null,
    latest: latestMatch ? latestMatch[1] : null,
    blockedBySelfUpdateGuard,
  };
}

export function checkWritableDir(name, dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return { name, status: 'success', message: `Writable: ${dir}` };
  } catch (err) {
    return { name, status: 'error', message: `Not writable: ${dir} (${err.message})`, fix: `Check permissions on ${dir}` };
  }
}

async function checkMpv(platform) {
  const versionResult = await run('mpv', ['--version']);
  if (versionResult.code === null) {
    return {
      name: 'mpv',
      status: 'error',
      message: 'mpv is not installed, or not on PATH.',
      fix: platform.getInstallInstructions(),
    };
  }
  const firstLine = versionResult.stdout.split('\n')[0] || 'unknown version';
  return { name: 'mpv', status: 'success', message: `Found: ${firstLine}` };
}

async function checkMpvDaemon(platform) {
  const alive = await new MpvDaemonSupervisor(platform).isRunning();
  return alive
    ? { name: 'mpv daemon', status: 'success', message: 'Reachable — already running in the background.' }
    : { name: 'mpv daemon', status: 'success', message: 'Not running yet — starts automatically the first time you play something.' };
}

async function checkYtDlp(platform) {
  const installs = findAllOnPath('yt-dlp');
  if (installs.length === 0) {
    return {
      name: 'yt-dlp',
      status: 'error',
      message: 'yt-dlp is not installed, or not on PATH.',
      fix: platform.getInstallInstructions(),
    };
  }

  const versionResult = await run('yt-dlp', ['--version']);
  const currentVersion = versionResult.stdout.trim() || 'unknown';

  if (installs.length > 1) {
    return {
      name: 'yt-dlp',
      status: 'warning',
      message: `Found ${installs.length} copies on PATH (using: ${installs[0]}) — current version ${currentVersion}.`,
      fix: `Multiple installs can shadow each other depending on PATH order. Installs found: ${installs.join(', ')}`,
    };
  }

  const updateResult = await run('yt-dlp', ['-U']);
  const { latest, blockedBySelfUpdateGuard } = parseUpdateOutput(`${updateResult.stdout}\n${updateResult.stderr}`);

  if (latest && latest !== currentVersion) {
    return {
      name: 'yt-dlp',
      status: 'warning',
      message: `Current version ${currentVersion} — a newer version (${latest}) is available.`,
      fix: blockedBySelfUpdateGuard
        ? 'Installed via a package manager that blocks self-update — try: pipx install yt-dlp --force (or brew upgrade yt-dlp)'
        : 'Run: yt-dlp -U',
    };
  }

  return { name: 'yt-dlp', status: 'success', message: `Current version ${currentVersion} — up to date.` };
}

export async function runDiagnostics(platform) {
  return Promise.all([
    checkMpv(platform),
    checkYtDlp(platform),
    checkMpvDaemon(platform),
    checkWritableDir('Config directory', platform.getConfigDir()),
    checkWritableDir('Audio cache directory', platform.getCacheDir()),
    checkWritableDir('Downloads directory', platform.getDownloadsDir()),
  ]);
}
