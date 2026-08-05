import chalk from 'chalk';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const NOISE_CHARS = '░▒▓█<>/\\|?#$@%!*&+=-~^0123456789ABCDEF';

function getCols() {
  return process.stdout.columns || 100;
}

/**
 * Generates a full-width line of Matrix digital rain.
 */
function getMatrixLine(width) {
  let line = '';
  for (let i = 0; i < width; i++) {
    const r = Math.random();
    if (r < 0.12) line += chalk.green.bold('1');
    else if (r < 0.24) line += chalk.green('0');
    else if (r < 0.38) line += chalk.dim.green(NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]);
    else if (r < 0.48) line += chalk.cyan(NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]);
    else if (r < 0.55) line += chalk.white.bold('█');
    else line += ' ';
  }
  return line;
}

/**
 * Renders a high-tech cyber progress loading bar.
 */
function renderProgressBar(percent, taskName) {
  const barWidth = 35;
  const completed = Math.floor((percent / 100) * barWidth);
  const remaining = barWidth - completed;

  const filledBar = chalk.bold.green('█'.repeat(completed));
  const emptyBar = chalk.dim.gray('░'.repeat(remaining));
  const pctStr = chalk.bold.cyan(`${String(percent).padStart(3, ' ')}%`);

  return `  ${chalk.bold.yellow('[LOADING]')} [${filledBar}${emptyBar}] ${pctStr} ${chalk.dim('│')} ${chalk.bold.white(taskName)}`;
}

/**
 * Scrambles target string with cyber noise characters.
 */
function scrambleText(text, ratio = 1.0) {
  return text.split('').map(ch => {
    if (ch === ' ' || ch === '\n' || ch === '│' || ch === '┌' || ch === '┐' || ch === '└' || ch === '┘' || ch === '─') return ch;
    if (Math.random() < ratio) {
      return NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)];
    }
    return ch;
  }).join('');
}

/**
 * Plays full-screen cyber hacker boot animation sequence.
 */
export async function playBootAnimation() {
  console.clear();
  const width = Math.max(80, getCols() - 2);

  // ─────────────────────────────────────────────────────────────
  // Phase 1: Full-Screen Digital Matrix Rain Cascade
  // ─────────────────────────────────────────────────────────────
  for (let i = 0; i < 14; i++) {
    console.log(getMatrixLine(width));
    await sleep(40);
  }
  await sleep(150);
  console.clear();

  // ─────────────────────────────────────────────────────────────
  // Phase 2: Cyber Workstation Frame & Slow Animated Loading Bar
  // ─────────────────────────────────────────────────────────────
  const border = '═'.repeat(Math.min(90, width - 4));
  console.log(chalk.cyan(` ╔${border}╗`));
  console.log(chalk.cyan(` ║  ${chalk.bold.green('MORENA CYBERSECURITY RECONNAISSANCE ENGINE v1.0.0')}              ║`));
  console.log(chalk.cyan(` ╠${border}╣`));

  const loadingTasks = [
    { pct: 15, task: 'INITIALIZING KERNEL SUBSYSTEMS...' },
    { pct: 35, task: 'CONNECTING PUPPETEER CHROMIUM ENGINE...' },
    { pct: 55, task: 'MOUNTING DOM REWRITE & ASSET PIPELINE...' },
    { pct: 75, task: 'LOADING OWASP SECURITY AUDITOR...' },
    { pct: 90, task: 'ENGAGING SECRET & ENDPOINT SCANNER...' },
    { pct: 100, task: 'SYSTEM FULLY ENGAGED & READY.' }
  ];

  for (const step of loadingTasks) {
    process.stdout.write('\r' + renderProgressBar(step.pct, step.task));
    await sleep(280);
  }
  console.log('\n' + chalk.cyan(` ╚${border}╝\n`));
  await sleep(200);

  // ─────────────────────────────────────────────────────────────
  // Phase 3: Multi-Column ASCII Computer & Telemetry Dashboard
  // ─────────────────────────────────────────────────────────────
  console.clear();

  const computerAscii = [
    ' ┌──────────────────┐ ',
    ' │ ________________ │ ',
    ' │ | MORENA CORE   || ',
    ' │ | STATUS: OK    || ',
    ' │ |________________|| ',
    ' └───────┬─┬────────┘ ',
    '  ┌──────┴─┴──────┐   ',
    '  │ ░░░░░░░░░░░░░ │   ',
    '  └───────────────┘   '
  ];

  const telemetryAscii = [
    ' ┌──[ TELEMETRY ]──────┐ ',
    ' │ HOST: Kali Linux    │ ',
    ' │ ENGINE: Puppeteer   │ ',
    ' │ CRYPTO: AES-256     │ ',
    ' │ SCANNER: Active     │ ',
    ' │ STATUS: ARMED       │ ',
    ' └─────────────────────┘ '
  ];

  const bannerLines = [
    '  ███╗   ███╗ ██████╗ ██████╗ ███████╗███╗   ██╗ █████╗ ',
    '  ████╗ ████║██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗',
    '  ██╔████╔██║██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████║',
    '  ██║╚██╔╝██║██║   ██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══██║',
    '  ██║ ╚═╝ ██║╚██████╔╝██║  ██║███████╗██║ ╚████║██║  ██║',
    '  ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚══'
  ];

  // Render combined dashboard layout line-by-line with text decryption effect
  for (let frame = 8; frame >= 0; frame--) {
    console.clear();
    const ratio = frame / 8;

    console.log(chalk.bold.green(' ┌─[ WORKSTATION ]──────┐' + ' '.repeat(35) + '┌─[ SYSTEM DASHBOARD ]─┐'));

    for (let i = 0; i < Math.max(computerAscii.length, bannerLines.length); i++) {
      const pcLine = computerAscii[i] || '                      ';
      const bLine = bannerLines[i] || '                                                      ';
      const telLine = telemetryAscii[i] || '                        ';

      const pcStyled = chalk.bold.cyan(pcLine);
      const bStyled = ratio === 0 ? chalk.bold.cyan(bLine) : chalk.green.bold(scrambleText(bLine, ratio));
      const telStyled = chalk.bold.yellow(telLine);

      console.log(`${pcStyled}  ${bStyled}  ${telStyled}`);
    }

    console.log(chalk.bold.green(' └──────────────────────┘' + ' '.repeat(35) + '└──────────────────────┘'));
    await sleep(40);
  }

  console.log('\n' + chalk.bold.yellow('   MORENA REPL v1.0.0 - Authorized Security Reconnaissance & Asset Audit Tool'));
  console.log(chalk.dim('   Type ') + chalk.bold.cyan('help') + chalk.dim(' to display available commands or ') + chalk.bold.cyan('exit-now') + chalk.dim(' to quit.\n'));
}
