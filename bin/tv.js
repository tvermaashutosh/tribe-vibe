#!/usr/bin/env node
import { run } from '../src/cli.js';

run(process.argv).catch((err) => {
  console.error(`tribe-vibe error: ${err.message}`);
  process.exit(1);
});
