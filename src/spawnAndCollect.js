import { spawn } from 'node:child_process';

// Spawns a command and collects its full stdout/stderr before resolving —
// never rejects on its own. A missing binary and a non-zero exit are both
// reported through the resolved value instead (spawnError set for the
// former, code non-zero for the latter), leaving what "failure" even means,
// and what to do about it, entirely up to the caller. Shared by every place
// in this codebase that shells out and needs the full output before acting:
// diagnostics checks (runDiagnostics.js) and yt-dlp search/download
// (youtubeResolver.js) — each used to reimplement this same spawn+collect
// boilerplate on its own.
export function spawnAndCollect(command, args) {
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
    proc.on('error', (spawnError) => resolve({ code: null, stdout, stderr, spawnError }));
    proc.on('close', (code) => resolve({ code, stdout, stderr, spawnError: null }));
  });
}
