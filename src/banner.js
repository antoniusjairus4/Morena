import chalk from 'chalk';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const NOISE_CHARS = '░▒▓█<>/\\|?#$@%!*&+=-~^0123456789ABCDEF';

function getRows() {
  return process.stdout.rows || 24;
}

function getCols() {
  return process.stdout.columns || 110;
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

let animationInterval = null;
let animTick = 0;

const pulseIcons = ['⚡', '🟢', '🔥', '🚀', '✨', '💎'];
const statusTexts = ['STATUS: OK    ', 'STATUS: ARMED ', 'STATUS: ACTIVE', 'STATUS: READY '];

/**
 * Calculates horizontal left margin for centering.
 */
function getCenterPadding(contentWidth) {
  const cols = getCols();
  return ' '.repeat(Math.max(0, Math.floor((cols - contentWidth) / 2)));
}

/**
 * Starts continuous live background animation for the centered ASCII header dashboard.
 */
export function startLiveHeaderAnimation() {
  if (animationInterval || !process.stdout.isTTY) return;

  animationInterval = setInterval(() => {
    animTick++;
    const icon = pulseIcons[animTick % pulseIcons.length];
    const statusStr = statusTexts[animTick % statusTexts.length];
    const pad = getCenterPadding(108);

    const currentPc = [
      ' ┌──────────────────┐ ',
      ' │ ________________ │ ',
      ' │ | MORENA CORE   || ',
      ` │ | ${statusStr} || `,
      ' │ |________________|| ',
      ' └───────┬─┬────────┘ ',
      '  ┌──────┴─┴──────┐   ',
      '  │ ░░░░░░░░░░░░░ │   ',
      '  └───────────────┘   '
    ];

    const currentTel = [
      ' ┌──[ TELEMETRY ]──────┐ ',
      ' │ HOST: Kali Linux    │ ',
      ' │ ENGINE: Puppeteer   │ ',
      ' │ CRYPTO: AES-256     │ ',
      ' │ SCANNER: Active     │ ',
      ` │ STATUS: ARMED ${icon}   │ `,
      ' └─────────────────────┘ '
    ];

    process.stdout.write('\x1B[s\x1B[1;1H');
    process.stdout.write(pad + chalk.bold.green(' ┌─[ WORKSTATION ]──────┐' + ' '.repeat(35) + '┌─[ SYSTEM DASHBOARD ]─┐\n'));

    for (let i = 0; i < Math.max(currentPc.length, bannerLines.length); i++) {
      const pcLine = currentPc[i] || '                      ';
      const bLine = bannerLines[i] || '                                                      ';
      const telLine = currentTel[i] || '                        ';

      const bStyled = animTick % 2 === 0 ? chalk.bold.cyan(bLine) : chalk.cyan(bLine);
      process.stdout.write(`${pad}${chalk.bold.cyan(pcLine)}  ${bStyled}  ${chalk.bold.yellow(telLine)}\n`);
    }

    process.stdout.write(pad + chalk.bold.green(' └──────────────────────┘' + ' '.repeat(35) + '└──────────────────────┘\n'));
    process.stdout.write('\x1B[u');
  }, 400);
}

export function stopLiveHeaderAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
}

/**
 * Displays the persistent horizontally centered computer workstation dashboard header.
 */
export function displayHeaderDashboard() {
  const pad = getCenterPadding(108);

  console.log(pad + chalk.bold.green(' ┌─[ WORKSTATION ]──────┐' + ' '.repeat(35) + '┌─[ SYSTEM DASHBOARD ]─┐'));

  for (let i = 0; i < Math.max(computerAscii.length, bannerLines.length); i++) {
    const pcLine = computerAscii[i] || '                      ';
    const bLine = bannerLines[i] || '                                                      ';
    const telLine = telemetryAscii[i] || '                        ';

    console.log(`${pad}${chalk.bold.cyan(pcLine)}  ${chalk.bold.cyan(bLine)}  ${chalk.bold.yellow(telLine)}`);
  }

  console.log(pad + chalk.bold.green(' └──────────────────────┘' + ' '.repeat(35) + '└──────────────────────┘\n'));
  
  const titleStr = 'MORENA REPL v1.0.0 - Authorized Security Reconnaissance & Asset Audit Tool';
  const titlePad = getCenterPadding(titleStr.length);
  console.log(titlePad + chalk.bold.yellow(titleStr));

  const helpStr = 'Type help to display available commands or exit-now to quit.';
  const helpPad = getCenterPadding(helpStr.length);
  console.log(helpPad + chalk.dim('Type ') + chalk.bold.cyan('help') + chalk.dim(' to display available commands or ') + chalk.bold.cyan('exit-now') + chalk.dim(' to quit.\n'));
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

  const totalDurationMs = 10000;
  const tickIntervalMs = 100;
  const totalTicks = totalDurationMs / tickIntervalMs;

  for (let tick = 0; tick <= totalTicks; tick++) {
    console.clear();

    const rows = getRows();
    const width = getCols();
    const pad = getCenterPadding(108);

    const percent = Math.min(100, Math.floor((tick / totalTicks) * 100));
    const currentTask = loadingTasks.find(t => percent >= t.from && percent <= t.to)?.task || 'INITIALIZING...';

    const frameLines = [];

    // 1. Centered Workstation + Scrambled Banner + Telemetry Header
    frameLines.push(pad + chalk.bold.green(' ┌─[ WORKSTATION ]──────┐' + ' '.repeat(35) + '┌─[ SYSTEM DASHBOARD ]─┐'));

    const shimmerRatio = percent < 90 ? Math.max(0.05, (100 - percent) / 200) : 0;

    for (let i = 0; i < Math.max(computerAscii.length, bannerLines.length); i++) {
      const pcLine = computerAscii[i] || '                      ';
      const bLine = bannerLines[i] || '                                                      ';
      const telLine = telemetryAscii[i] || '                        ';

      const pcStyled = chalk.bold.cyan(pcLine);
      const bStyled = shimmerRatio === 0 ? chalk.bold.cyan(bLine) : chalk.green.bold(scrambleText(bLine, shimmerRatio));
      const telStyled = chalk.bold.yellow(telLine);

      frameLines.push(`${pad}${pcStyled}  ${bStyled}  ${telStyled}`);
    }

    frameLines.push(pad + chalk.bold.green(' └──────────────────────┘' + ' '.repeat(35) + '└──────────────────────┘'));

    // 2. Bottom Fixed Cyber Loading Bar (3 lines)
    const barLineWidth = Math.min(92, width - 6);
    const barPad = getCenterPadding(barLineWidth + 4);

    const barWidth = Math.max(25, Math.min(40, barLineWidth - 44));
    const completed = Math.floor((percent / 100) * barWidth);
    const remaining = barWidth - completed;

    const filledBar = chalk.bold.green('█'.repeat(completed));
    const emptyBar = chalk.dim.gray('░'.repeat(remaining));
    const pctStr = chalk.bold.cyan(`${String(percent).padStart(3, ' ')}%`);
    const borderLine = '═'.repeat(barLineWidth);

    const loadingBarLines = [
      barPad + chalk.cyan(` ╔${borderLine}╗`),
      barPad + ` ║ ${chalk.bold.yellow('[LOADING 10s]')} [${filledBar}${emptyBar}] ${pctStr} ${chalk.dim('│')} ${chalk.bold.white(currentTask.padEnd(42, ' '))} ║`,
      barPad + chalk.cyan(` ╚${borderLine}╝`)
    ];

    // 3. Fill available vertical space with Matrix digital rain
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
