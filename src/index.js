#!/usr/bin/env node

import chalk from 'chalk';
import { startRepl } from './repl.js';

function displayBanner() {
  console.log('\n' + chalk.bold.cyan(`
   ███╗   ███╗ ██████╗ ██████╗ ███████╗███╗   ██╗██████╗ 
   ████╗ ████║██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗
   ██╔████╔██║██║   ██║██████╔╝█████╗  ██╔██╗ ██║██████╔╝
   ██║╚██╔╝██║██║   ██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══██╗
   ██║ ╚═╝ ██║╚██████╔╝██║  ██║███████╗██║ ╚████║██║  ██║
   ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝
  `));
  console.log(chalk.bold.yellow('   Morena REPL v1.0.0 - Authorized Security & Asset Audit Tool'));
  console.log(chalk.dim('   Type ') + chalk.bold.cyan('help') + chalk.dim(' to display available commands or ') + chalk.bold.cyan('exit-now') + chalk.dim(' to quit.\n'));
}

displayBanner();
startRepl();
