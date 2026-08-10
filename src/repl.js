import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';

import { session } from './session.js';
import { validateUrl } from './utils/urlValidator.js';
import { scrapeDOM } from './scraper.js';
import { downloadAndStageAssets } from './assetManager.js';
import { createZipArchive } from './archiver.js';
import { analyzeTechStack } from './analyzer/techStack.js';
import { scanForSecrets } from './analyzer/secretsScanner.js';
import { extractEndpoints } from './analyzer/endpointExtractor.js';
import { auditSecurityHeaders } from './analyzer/headerAuditor.js';
import { generateReport } from './reporter.js';

/**
 * Builds a nested tree object from relative file paths.
 */
function buildTreeObject(filePaths) {
  const root = {};
  for (const fp of filePaths) {
    const parts = fp.split(/[/\\]+/).filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = null;
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    }
  }
  return root;
}

/**
 * Prints hierarchical ASCII tree structure with chalk colors.
 */
function printHierarchicalTree(node, prefix = '') {
  const keys = Object.keys(node);
  keys.forEach((key, index) => {
    const isLast = index === keys.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    const isDirectory = node[key] !== null;

    if (isDirectory) {
      console.log(`${prefix}${connector}${chalk.cyan.bold(key + '/')}`);
      printHierarchicalTree(node[key], prefix + childPrefix);
    } else {
      console.log(`${prefix}${connector}${chalk.green(key)}`);
    }
  });
}

/**
 * Interactive question helper using existing readline interface.
 */
function askQuestion(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Generates default output path in ~/Downloads.
 */
async function getDefaultOutputPath(prefix = 'morena-dump') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${prefix}-${timestamp}.zip`;
  const downloadsFolder = path.join(os.homedir(), 'Downloads');
  try {
    await fs.access(downloadsFolder);
    return path.join(downloadsFolder, filename);
  } catch {
    return path.join(process.cwd(), filename);
  }
}

function getCols() {
  return process.stdout.columns || 90;
}

/**
 * Cyberpunk Complete Closed Box Header & Footer.
 */
const renderCyberDockHeader = () => {
  const width = Math.max(60, getCols() - 6);
  const topBorder = chalk.bold.green(' ╭' + '─'.repeat(width) + '╮');
  return topBorder;
};

const renderCyberDockFooter = () => {
  const width = Math.max(60, getCols() - 6);
  return chalk.bold.green(' ╰' + '─'.repeat(width) + '╯');
};

const cyberPromptStr = chalk.bold.green(' │ > ');

/**
 * Main REPL Command Router and Prompt Loop.
 */
export function startRepl() {
  process.stdin.resume();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: cyberPromptStr
  });

  const promptUser = () => {
    console.log(renderCyberDockHeader());
    rl.prompt();
  };

  rl.on('SIGINT', () => {
    console.log(chalk.yellow('\n[-] Use \'exit-now\' to quit Morena.'));
    promptUser();
  });

  promptUser();

  rl.on('line', async (line) => {
    console.log(renderCyberDockFooter());
    const input = line.trim();
    if (!input) {
      promptUser();
      return;
    }

    session.addHistory(input);
    const [command, ...args] = input.split(/\s+/);

    try {
      switch (command.toLowerCase()) {
        // ──────────────────────────────────────────────
        // TARGET
        // ──────────────────────────────────────────────
        case 'target': {
          if (session.isLocked()) {
            console.log(
              chalk.yellow(
                `[-] A target session is currently active (${chalk.cyan(
                  session.targetUrl.href
                )}). Use 'exit-now' to terminate session before locking a new target.`
              )
            );
          } else {
            const rawUrl = args[0];
            if (!rawUrl) {
              console.log(chalk.red('[-] Usage: target <url>'));
            } else {
              const validated = validateUrl(rawUrl);
              session.lockTarget(validated);
              console.log(
                chalk.green.bold(`[+] Target identified and locked: ${validated.href}`)
              );
            }
          }
          break;
        }

        // ──────────────────────────────────────────────
        // SHOW
        // ──────────────────────────────────────────────
        case 'show': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No active target session. Use \'target <url>\' first.'));
          } else if (!session.scrapedFilesList || session.scrapedFilesList.length === 0) {
            console.log(
              chalk.yellow(
                `[-] No scraped data found for ${session.targetUrl.href}. Run 'take' first to capture frontend assets.`
              )
            );
          } else {
            console.log(chalk.bold.underline(`\nHierarchical Asset Tree for ${session.targetUrl.href}:`));
            console.log(chalk.cyan.bold('/ (scraped root)'));
            const treeObj = buildTreeObject(session.scrapedFilesList);
            printHierarchicalTree(treeObj);
            console.log('');
          }
          break;
        }

        // ──────────────────────────────────────────────
        // TAKE (Scrape target page and capture assets)
        // ──────────────────────────────────────────────
        case 'take': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }

          const spinner = ora();
          let currentHtml, currentPageUrl;
          try {
            spinner.start('Launching headless browser and navigating to target...');
            const result = await scrapeDOM(session.targetUrl.href, session.timeoutSeconds);
            currentHtml = result.html;
            currentPageUrl = result.pageUrl;
            spinner.succeed(`Scraped final runtime DOM from ${chalk.cyan(currentPageUrl)}`);
          } catch (err) {
            spinner.fail(chalk.red('Scraping failed.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
            break;
          }

          // Download frontend assets for target page
          let staged;
          try {
            spinner.start('Hunting and downloading frontend CSS, JS, and image dependencies...');
            staged = await downloadAndStageAssets(currentHtml, currentPageUrl);
            session.stagingDir = staged.stagingDir;
            session.scrapedData = staged;
            session.scrapedFilesList = staged.fileList;
            spinner.succeed(`Downloaded ${chalk.bold(staged.assetCount)} frontend asset dependencies`);
          } catch (err) {
            spinner.fail(chalk.red('Asset download failed.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
            break;
          }

          // Archive final result
          const defaultOutput = await getDefaultOutputPath();
          rl.pause();
          const dest = await askQuestion(rl, chalk.bold.yellow(`\nSave archive to (Enter for ${defaultOutput}): `));
          rl.resume();
          const outputPath = dest ? path.resolve(dest) : defaultOutput;

          const archiveSpinner = ora(`Compressing into archive: ${chalk.bold(outputPath)}...`).start();
          const archive = await createZipArchive(session.stagingDir, outputPath);
          session.stagingDir = null;
          archiveSpinner.succeed(chalk.green.bold('[+] Packaging complete! Archive successfully generated.'));

          const sizeMB = (archive.sizeBytes / (1024 * 1024)).toFixed(2);
          console.log(`${chalk.dim('Destination:')} ${chalk.cyan(archive.archivePath)}`);
          console.log(`${chalk.dim('Size:')} ${chalk.yellow(`${sizeMB} MB`)} (${archive.sizeBytes} bytes)\n`);
          break;
        }

        // ──────────────────────────────────────────────
        // SCESSION -TIME
        // ──────────────────────────────────────────────
        case 'scession': {
          if (args[0] === '-time') {
            if (!session.isLocked()) {
              console.log(chalk.yellow('[-] No active target session locked.'));
            } else {
              const { minutes, seconds } = session.getDuration();
              console.log(
                chalk.green.bold(
                  `[+] Active target session duration: ${minutes} minute(s), ${seconds} second(s)`
                )
              );
            }
          } else {
            console.log(chalk.yellow('[-] Unknown command. Did you mean \'scession -time\'?'));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // HEADERS
        // ──────────────────────────────────────────────
        case 'headers': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No active target locked. Use \'target <url>\' first.'));
            break;
          }
          const spinner = ora('Fetching HTTP response headers...').start();
          try {
            let res;
            try {
              res = await fetch(session.targetUrl.href, {
                method: 'HEAD',
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
              });
            } catch {
              res = await fetch(session.targetUrl.href, {
                method: 'GET',
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
              });
            }
            spinner.stop();
            console.log(chalk.bold.underline(`\nHTTP Response Headers for ${session.targetUrl.href}:`));
            console.log(chalk.cyan(`HTTP/1.1 ${res.status} ${res.statusText}`));
            for (const [key, value] of res.headers.entries()) {
              console.log(`${chalk.yellow(key)}: ${value}`);
            }
            console.log('');
          } catch (err) {
            spinner.fail(chalk.red('Failed to fetch headers.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // INFO
        // ──────────────────────────────────────────────
        case 'info': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No active target session. Use \'target <url>\' first.'));
          } else {
            const { minutes, seconds } = session.getDuration();
            console.log(chalk.bold.cyan('\n┌──────────────────────────────────────────────────────────┐'));
            console.log(chalk.bold.cyan('│                 MORENA SESSION STATUS CARD               │'));
            console.log(chalk.bold.cyan('├──────────────────────────────────────────────────────────┤'));
            console.log(`  ${chalk.dim('Target URL:')}       ${session.targetUrl.href}`);
            console.log(`  ${chalk.dim('Session Duration:')} ${minutes}m ${seconds}s`);
            console.log(`  ${chalk.dim('Timeout Limit:')}    ${session.timeoutSeconds} seconds`);
            console.log(
              `  ${chalk.dim('Scraped Assets:')}   ${
                session.scrapedFilesList && session.scrapedFilesList.length > 0
                  ? `${session.scrapedFilesList.length} file(s)`
                  : 'Not yet scraped (use \'take\')'
              }`
            );
            console.log(chalk.bold.cyan('└──────────────────────────────────────────────────────────┘\n'));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // SET-TIMEOUT
        // ──────────────────────────────────────────────
        case 'set-timeout': {
          if (!args[0]) {
            console.log(chalk.red('[-] Usage: set-timeout <seconds>'));
          } else {
            session.setTimeoutSeconds(args[0]);
            console.log(
              chalk.green(`[+] Session page load timeout updated to ${session.timeoutSeconds} seconds.`)
            );
          }
          break;
        }

        // ──────────────────────────────────────────────
        // TECH-STACK
        // ──────────────────────────────────────────────
        case 'tech-stack': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }
          const spinner = ora('Fingerprinting target technology stack...').start();
          try {
            const res = await fetch(session.targetUrl.href, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            });
            const html = await res.text();
            const tech = analyzeTechStack(html, res.headers);
            spinner.stop();

            console.log(chalk.bold.underline(`\nTechnology Stack Fingerprints for ${session.targetUrl.href}:`));
            console.log(`  ${chalk.dim('Frameworks:')}       ${tech.frameworks.length ? chalk.cyan(tech.frameworks.join(', ')) : chalk.dim('None detected')}`);
            console.log(`  ${chalk.dim('UI Libraries:')}     ${tech.uiLibraries.length ? chalk.cyan(tech.uiLibraries.join(', ')) : chalk.dim('None detected')}`);
            console.log(`  ${chalk.dim('Analytics/CDNs:')}   ${tech.analytics.length ? chalk.cyan(tech.analytics.join(', ')) : chalk.dim('None detected')}`);
            console.log(`  ${chalk.dim('Server Headers:')}    ${tech.servers.length ? chalk.cyan(tech.servers.join(' | ')) : chalk.dim('None detected')}`);
            if (tech.metaTools.length) console.log(`  ${chalk.dim('Meta Generator:')}   ${chalk.yellow(tech.metaTools.join(', '))}`);
            console.log('');
          } catch (err) {
            spinner.fail(chalk.red('Tech stack fingerprinting failed.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // AUDIT (OWASP Headers)
        // ──────────────────────────────────────────────
        case 'audit': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }
          const spinner = ora('Auditing HTTP security headers against OWASP guidelines...').start();
          try {
            const res = await fetch(session.targetUrl.href, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            });
            const auditResult = auditSecurityHeaders(res.headers);
            spinner.stop();

            console.log(chalk.bold.underline(`\nOWASP Response Header Security Audit for ${session.targetUrl.href}:`));
            console.log(`  ${chalk.dim('Overall Grade:')}     ${auditResult.gradeColor(auditResult.grade)}`);
            console.log(`  ${chalk.dim('Header Score:')}      ${auditResult.scoreColor(`${auditResult.score}/100`)}\n`);

            console.log(chalk.bold('Security Header Checks:'));
            auditResult.checks.forEach((check) => {
              const symbol = check.passed ? chalk.green('✓') : chalk.red('✗');
              const headerName = check.passed ? chalk.green(check.header) : chalk.red(check.header);
              console.log(`  ${symbol} ${headerName.padEnd(30, ' ')} ${chalk.dim(check.details)}`);
            });
            console.log('');
          } catch (err) {
            spinner.fail(chalk.red('Header audit failed.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // SECRETS (Scanner)
        // ──────────────────────────────────────────────
        case 'secrets': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }
          const spinner = ora('Scanning target source and frontend assets for secrets...').start();
          try {
            let contentToScan = session.stagingDir;
            if (!contentToScan) {
              const res = await fetch(session.targetUrl.href, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
              });
              contentToScan = await res.text();
            }

            const findings = await scanForSecrets(contentToScan);
            spinner.stop();

            console.log(chalk.bold.underline(`\nSecret & Sensitive Information Findings for ${session.targetUrl.href}:`));
            if (findings.length === 0) {
              console.log(chalk.green('  ✓ No hardcoded secrets, API keys, or sensitive comments detected.\n'));
            } else {
              findings.forEach((f) => {
                console.log(`  ${chalk.red.bold('!')} ${chalk.yellow(f.rule.padEnd(25, ' '))} ${chalk.dim('→')} ${chalk.cyan(f.match)}`);
              });
              console.log('');
            }
          } catch (err) {
            spinner.fail(chalk.red('Secret scanning failed.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // ENDPOINTS (Extractor)
        // ──────────────────────────────────────────────
        case 'endpoints': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }
          const spinner = ora('Extracting hidden REST endpoints, API routes, and WebSockets...').start();
          try {
            let contentToScan = session.stagingDir;
            if (!contentToScan) {
              const res = await fetch(session.targetUrl.href, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
              });
              contentToScan = await res.text();
            }

            const endpoints = await extractEndpoints(contentToScan);
            spinner.stop();

            console.log(chalk.bold.underline(`\nExtracted API Endpoints & Routes for ${session.targetUrl.href}:`));
            if (endpoints.length === 0) {
              console.log(chalk.yellow('  No API endpoints or routes extracted.\n'));
            } else {
              endpoints.forEach((ep) => {
                const methodColor = ep.method === 'WS' ? chalk.magenta : chalk.blue;
                console.log(`  ${methodColor(ep.method.padEnd(6, ' '))} ${chalk.cyan(ep.url)}`);
              });
              console.log('');
            }
          } catch (err) {
            spinner.fail(chalk.red('Endpoint extraction failed.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // REPORT
        // ──────────────────────────────────────────────
        case 'report': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }
          const spinner = ora('Compiling reconnaissance & security assessment report...').start();
          try {
            const res = await fetch(session.targetUrl.href, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            });
            const html = await res.text();

            const techStack = analyzeTechStack(html, res.headers);
            const audit = auditSecurityHeaders(res.headers);
            const secrets = await scanForSecrets(session.stagingDir || html);
            const endpoints = await extractEndpoints(session.stagingDir || html);

            const reportResult = await generateReport({
              targetUrl: session.targetUrl.href,
              duration: session.getDuration(),
              techStack,
              audit,
              secrets,
              endpoints,
              scrapedFilesCount: session.scrapedFilesList ? session.scrapedFilesList.length : 0
            });

            spinner.succeed(chalk.green.bold(`[+] Security audit report generated!`));
            console.log(`${chalk.dim('Location:')} ${chalk.cyan(reportResult.outputPath)}`);
            console.log(`${chalk.dim('Summary:')}  ${chalk.red(`${reportResult.failCount} Header Failures`)}; ${chalk.yellow(`${reportResult.secretsCount} Secret Findings`)}\n`);
          } catch (err) {
            spinner.fail(chalk.red('Report generation failed.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // STATUS
        // ──────────────────────────────────────────────
        case 'status': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }
          const spinner = ora('Pinging target URL...').start();
          try {
            const startTime = Date.now();
            const res = await fetch(session.targetUrl.href, {
              method: 'GET',
              headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            });
            const responseTime = Date.now() - startTime;
            spinner.stop();
            const statusColor = res.ok ? chalk.green : chalk.red;
            console.log(
              `[+] Target Status: ${statusColor(`${res.status} ${res.statusText}`)} (${responseTime}ms)`
            );
          } catch (err) {
            spinner.fail(chalk.red('Ping failed.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // CLEAN
        // ──────────────────────────────────────────────
        case 'clean': {
          await session.cleanStaging();
          session.scrapedFilesList = [];
          console.log(chalk.green('[+] Staging directory and temporary caches cleared.'));
          break;
        }

        // ──────────────────────────────────────────────
        // HISTORY
        // ──────────────────────────────────────────────
        case 'history': {
          console.log(chalk.bold.underline('\nSession Command History:'));
          session.commandHistory.forEach((cmd, idx) => {
            console.log(`  ${chalk.dim(idx + 1 + '.')} ${cmd}`);
          });
          console.log('');
          break;
        }

        // ──────────────────────────────────────────────
        // HELP
        // ──────────────────────────────────────────────
        case 'help': {
          console.log(chalk.bold.cyan('\nAvailable Morena Commands:'));
          console.log(chalk.dim('  ── Target & Session ──'));
          console.log(`  ${chalk.yellow('target <url>')}       - Lock active session target URL`);
          console.log(`  ${chalk.yellow('scession -time')}     - Display session duration since lock`);
          console.log(`  ${chalk.yellow('info')}               - Display session status summary card`);
          console.log(`  ${chalk.yellow('set-timeout <sec>')}  - Dynamically set Puppeteer timeout limit`);
          console.log(chalk.dim('  ── Scraping & Archiving ──'));
          console.log(`  ${chalk.yellow('take')}               - Scrape target page and capture frontend assets`);
          console.log(`  ${chalk.yellow('show')}               - Display hierarchical tree of scraped files`);
          console.log(chalk.dim('  ── Security Recon & Auditing ──'));
          console.log(`  ${chalk.yellow('tech-stack')}         - Fingerprint frameworks, libraries, CDNs, & servers`);
          console.log(`  ${chalk.yellow('secrets')}            - Scan scraped JS assets for leaked keys, tokens, & comments`);
          console.log(`  ${chalk.yellow('endpoints')}          - Extract hidden REST API routes & WebSockets from JS`);
          console.log(`  ${chalk.yellow('audit')}              - Audit response headers against OWASP guidelines`);
          console.log(`  ${chalk.yellow('report')}             - Generate formatted HTML security audit report`);
          console.log(chalk.dim('  ── Utilities ──'));
          console.log(`  ${chalk.yellow('headers')}            - Fetch target HTTP response headers`);
          console.log(`  ${chalk.yellow('status')}             - Ping target URL for HTTP status`);
          console.log(`  ${chalk.yellow('clean')}              - Delete temporary staging files`);
          console.log(`  ${chalk.yellow('history')}            - Show executed command history`);
          console.log(`  ${chalk.yellow('exit-now')}           - Clean staging files and terminate shell\n`);
          break;
        }

        // ──────────────────────────────────────────────
        // EXIT
        // ──────────────────────────────────────────────
        case 'exit-now':
        case 'exit':
        case 'quit': {
          console.log(chalk.cyan('\nCleaning up session and exiting Morena...'));
          await session.resetSession();
          rl.close();
          process.exit(0);
        }

        default: {
          console.log(
            chalk.yellow(`[-] Unknown command: '${command}'. Type 'help' for available commands.`)
          );
        }
      }
    } catch (err) {
      console.log(chalk.red(`[-] Error executing command: ${err.message}`));
    }

    process.stdin.resume();
    promptUser();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
