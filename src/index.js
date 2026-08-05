#!/usr/bin/env node

import { playBootAnimation } from './banner.js';
import { startRepl } from './repl.js';

async function main() {
  if (!process.env.MORENA_FAST) {
    await playBootAnimation();
  }
  startRepl();
}

main().catch(console.error);
