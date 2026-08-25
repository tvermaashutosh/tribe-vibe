#!/usr/bin/env node
import { run } from '../src/cli.js';
import { trace } from '../src/debugTrace.js';
import { formatCliStatus } from '../src/ui/statusLevel.js';

trace('bin/tv.js: starting run()');
run(process.argv)
  .then(() => trace('bin/tv.js: run() resolved successfully, letting the event loop drain naturally'))
  .catch((err) => {
    trace(`bin/tv.js: run() rejected: ${err.message}`);
    console.error(formatCliStatus('error', `tv error: ${err.message}`));
    process.exit(1);
  });
