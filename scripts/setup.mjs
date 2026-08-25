import { spawn } from 'node:child_process';
import { getPlatform } from '../src/platform/index.js';
import { runDiagnostics } from '../src/diagnostics/runDiagnostics.js';
import { formatCliStatus } from '../src/ui/statusLevel.js';

// npm itself is a .cmd shim on Windows — spawn('npm', ...) without shell:true
// throws ENOENT there, a well-known Node cross-platform gotcha. Using the
// real executable name per OS avoids needing a shell at all.
const NPM_COMMAND = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runStep(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))));
  });
}

// platform.getInstallInstructions() is always a fixed, trusted string this
// codebase itself defines (never user input) — splitting on spaces and
// spawning directly avoids needing a shell (and the injection surface that
// would come with one) for something this simple.
function runInstallCommand(fullCommand) {
  const [command, ...args] = fullCommand.split(' ');
  return runStep(command, args);
}

async function main() {
  const installDeps = process.argv.includes('--install-deps');
  const platform = getPlatform();

  console.log(formatCliStatus('success', 'Installing npm packages...'));
  await runStep(NPM_COMMAND, ['install']);

  console.log(formatCliStatus('success', 'Building...'));
  await runStep(NPM_COMMAND, ['run', 'build']);

  // A failed link (commonly a permissions issue on the global npm prefix)
  // shouldn't block the dependency check below — it's independently useful
  // even if the user still needs to sort out linking themselves.
  try {
    console.log(formatCliStatus('success', 'Linking tv onto PATH...'));
    await runStep(NPM_COMMAND, ['link']);
  } catch (err) {
    console.log(formatCliStatus('warning', `npm link failed (${err.message}) — you may need elevated permissions, or run it yourself.`));
  }

  console.log('\nChecking mpv, yt-dlp, and the hotkey daemon...\n');
  const results = await runDiagnostics(platform);
  for (const result of results) {
    console.log(formatCliStatus(result.status, `${result.name}: ${result.message}`));
  }

  const missing = results.filter((result) => result.missing);
  if (missing.length === 0) {
    console.log(formatCliStatus('success', '\nAll set — try: tv'));
    return;
  }

  const installCommand = platform.getInstallInstructions();
  if (!installDeps) {
    console.log(formatCliStatus('warning', `\nMissing: ${missing.map((result) => result.name).join(', ')}`));
    console.log(`Run: ${installCommand}`);
    console.log('(or re-run this with --install-deps to have it run that for you)');
    return;
  }

  console.log(formatCliStatus('warning', `\nInstalling missing deps: ${missing.map((result) => result.name).join(', ')}`));
  console.log(`Running: ${installCommand}`);
  await runInstallCommand(installCommand);
  console.log(formatCliStatus('success', '\nDone — try: tv'));
}

main().catch((err) => {
  console.error(formatCliStatus('error', `setup failed: ${err.message}`));
  process.exit(1);
});
