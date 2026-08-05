#!/usr/bin/env node

import { playBootAnimation, displayHeaderDashboard } from './banner.js';
import { startRepl } from './repl.js';

async function main() {
  if (!process.env.MORENA_FAST) {
    await playBootAnimation();
  }
  displayHeaderDashboard();
  startRepl();
}

main().catch(console.error);
