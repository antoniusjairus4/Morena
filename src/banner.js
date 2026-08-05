import chalk from 'chalk';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const NOISE_CHARS = '░▒▓█<>/\\|?#$@%!*&+=-~^01';

/**
 * Generates a line of random matrix / hex cyber rain text.
 */
function getRandomMatrixLine(width = 70) {
  let line = '';
  for (let i = 0; i < width; i++) {
    const r = Math.random();
    if (r < 0.15) line += chalk.green.bold('1');
    else if (r < 0.30) line += chalk.green('0');
    else if (r < 0.45) line += chalk.dim.green(NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]);
    else if (r < 0.60) line += chalk.cyan(NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]);
    else if (r < 0.70) line += chalk.white.bold('█');
    else line += ' ';
  }
  return line;
}

/**
 * Scrambles target ASCII text with random noise characters.
 */
function scrambleText(text, ratio = 1.0) {
  return text.split('').map(ch => {
    if (ch === ' ' || ch === '\n') return ch;
    if (Math.random() < ratio) {
      return NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)];
    }
    return ch;
  }).join('');
}

/**
 * Plays the ultimate cyber hacker boot animation sequence.
 */
export async function playBootAnimation() {
  console.clear();

  // Phase 1: Matrix Digital Rain Stream (Fast)
  for (let i = 0; i < 8; i++) {
    console.log(getRandomMatrixLine(76));
    await sleep(40);
  }
  await sleep(100);
  console.clear();

  // Phase 2: Genact Kernel & Subsystem Diagnostics
  const diagSteps = [
    'INIT_KERNEL_CORE [v1.0.0-kali]',
    'ENGAGING_PUPPETEER_HEADLESS_ENGINE',
    'MOUNTING_DOM_REWRITE_PIPELINE',
    'INITIALIZING_OWASP_SECURITY_AUDITOR',
    'ENABLING_SECRET_PATTERN_SCANNER',
    'LOADING_INTERACTIVE_REPL_ROUTER'
  ];

  console.log(chalk.bold.cyan('┌──[ MORENA CYBER RECON SYSTEM ]─────────────────────────────┐'));
  for (const step of diagSteps) {
    const dots = '.'.repeat(38 - step.length);
    process.stdout.write(`│ ${chalk.dim('[+]')} ${chalk.green.bold(step)} ${chalk.dim(dots)} `);
    await sleep(60);
    process.stdout.write(`${chalk.bold.green('[OK]')}\n`);
    await sleep(40);
  }
  console.log(chalk.bold.cyan('└─────────────────────────────────────────────────────────────┘\n'));
  await sleep(150);

  // Phase 3: No More Secrets Decryption of MORENA Banner
  const rawBannerLines = [
    '   ███╗   ███╗ ██████╗ ██████╗ ███████╗███╗   ██╗ █████╗ ',
    '   ████╗ ████║██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗',
    '   ██╔████╔██║██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████║',
    '   ██║╚██╔╝██║██║   ██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══██║',
    '   ██║ ╚═╝ ██║╚██████╔╝██║  ██║███████╗██║ ╚████║██║  ██║',
    '   ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝'
  ];

  // Scramble frames
  for (let frame = 10; frame >= 0; frame--) {
    const ratio = frame / 10;
    process.stdout.write('\x1B[6A'); // Move cursor up 6 lines
    for (const line of rawBannerLines) {
      if (ratio === 0) {
        console.log(chalk.bold.cyan(line));
      } else {
        const scrambled = scrambleText(line, ratio);
        console.log(chalk.green.bold(scrambled));
      }
    }
    await sleep(40);
  }

  console.log('\n' + chalk.bold.yellow('   MORENA REPL v1.0.0 - Authorized Security & Asset Audit Tool'));
  console.log(chalk.dim('   Type ') + chalk.bold.cyan('help') + chalk.dim(' to display available commands or ') + chalk.bold.cyan('exit-now') + chalk.dim(' to quit.\n'));
}
