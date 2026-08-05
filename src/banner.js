import chalk from 'chalk';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const NOISE_CHARS = '░▒▓█<>/\\|?#$@%!*&+=-~^0123456789ABCDEF';

function getRows() {
  return process.stdout.rows || 24;
}

function getCols() {
  return process.stdout.columns || 90;
}

/**
 * Generates a line of Matrix digital rain.
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
 * Scrambles text with random cyber noise characters.
 */
function scrambleText(text, ratio = 0.3) {
  return text.split('').map(ch => {
    if (ch === ' ' || ch === '\n' || ch === '│' || ch === '┌' || ch === '┐' || ch === '└' || ch === '┘' || ch === '─' || ch === '═' || ch === '╔' || ch === '╗' || ch === '╚' || ch === '╝') return ch;
    if (Math.random() < ratio) {
      return NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)];
    }
    return ch;
  }).join('');
}

/**
 * Plays full-screen live dashboard frame + 10-second bottom loading bar.
 */
export async function playBootAnimation() {
  const loadingTasks = [
    { from: 0, to: 20, task: 'INITIALIZING KERNEL SUBSYSTEMS...' },
    { from: 20, to: 40, task: 'CONNECTING PUPPETEER CHROMIUM ENGINE...' },
    { from: 40, to: 60, task: 'MOUNTING DOM REWRITE & ASSET PIPELINE...' },
    { from: 60, to: 80, task: 'LOADING OWASP SECURITY AUDITOR...' },
    { from: 80, to: 95, task: 'ENGAGING SECRET & ENDPOINT SCANNER...' },
    { from: 95, to: 100, task: 'SYSTEM INITIALIZATION COMPLETE.' }
  ];

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

  const totalDurationMs = 10000; // Exactly 10 seconds
  const tickIntervalMs = 100;    // 100ms per tick = 100 ticks total
  const totalTicks = totalDurationMs / tickIntervalMs;

  for (let tick = 0; tick <= totalTicks; tick++) {
    console.clear();

    const rows = getRows();
    const width = Math.max(85, getCols() - 2);
    const percent = Math.min(100, Math.floor((tick / totalTicks) * 100));
    const currentTask = loadingTasks.find(t => percent >= t.from && percent <= t.to)?.task || 'INITIALIZING...';

    const frameLines = [];

    // 1. Middle Workstation + Scrambled Banner + Telemetry Dashboard Header
    frameLines.push(chalk.bold.green(' ┌─[ WORKSTATION ]──────┐' + ' '.repeat(35) + '┌─[ SYSTEM DASHBOARD ]─┐'));

    const shimmerRatio = percent < 90 ? Math.max(0.05, (100 - percent) / 200) : 0;

    for (let i = 0; i < Math.max(computerAscii.length, bannerLines.length); i++) {
      const pcLine = computerAscii[i] || '                      ';
      const bLine = bannerLines[i] || '                                                      ';
      const telLine = telemetryAscii[i] || '                        ';

      const pcStyled = chalk.bold.cyan(pcLine);
      const bStyled = shimmerRatio === 0 ? chalk.bold.cyan(bLine) : chalk.green.bold(scrambleText(bLine, shimmerRatio));
      const telStyled = chalk.bold.yellow(telLine);

      frameLines.push(`${pcStyled}  ${bStyled}  ${telStyled}`);
    }

    frameLines.push(chalk.bold.green(' └──────────────────────┘' + ' '.repeat(35) + '└──────────────────────┘'));

    // 2. Bottom Fixed Cyber Loading Bar (3 lines)
    const barWidth = Math.max(25, Math.min(40, width - 48));
    const completed = Math.floor((percent / 100) * barWidth);
    const remaining = barWidth - completed;

    const filledBar = chalk.bold.green('█'.repeat(completed));
    const emptyBar = chalk.dim.gray('░'.repeat(remaining));
    const pctStr = chalk.bold.cyan(`${String(percent).padStart(3, ' ')}%`);
    const borderLine = '═'.repeat(Math.min(92, width - 4));

    const loadingBarLines = [
      chalk.cyan(` ╔${borderLine}╗`),
      ` ║ ${chalk.bold.yellow('[LOADING 10s]')} [${filledBar}${emptyBar}] ${pctStr} ${chalk.dim('│')} ${chalk.bold.white(currentTask.padEnd(42, ' '))} ║`,
      chalk.cyan(` ╚${borderLine}╝`)
    ];

    // 3. Fill available vertical space with live Matrix digital rain lines to push loading bar to physical terminal bottom
    const usedLines = frameLines.length + loadingBarLines.length;
    const fillerRainLines = Math.max(1, rows - usedLines - 1);

    for (let r = 0; r < fillerRainLines; r++) {
      frameLines.push(getMatrixLine(width));
    }

    // Append bottom loading bar
    frameLines.push(...loadingBarLines);

    // Print entire frame
    process.stdout.write(frameLines.join('\n') + '\n');

    await sleep(tickIntervalMs);
  }

  await sleep(200);
  console.clear();
}
