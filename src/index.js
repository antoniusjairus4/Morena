#!/usr/bin/env node

import { playBootAnimation, displayHeaderDashboard, startLiveHeaderAnimation } from './banner.js';
import { startRepl } from './repl.js';

async function main() {
  if (!process.env.MORENA_FAST) {
    await playBootAnimation();
  }
  displayHeaderDashboard();
  startRepl();
  startLiveHeaderAnimation();
}

main().catch(console.error);
