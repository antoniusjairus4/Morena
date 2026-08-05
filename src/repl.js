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

/**
 * Creates directory tree display for staged files.
 */
async function printDirectoryTree(dir, prefix = '') {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const subPrefix = isLast ? '    ' : '│   ';

      if (entry.isDirectory()) {
        console.log(`${prefix}${connector}${chalk.cyan.bold(entry.name + '/')}`);
        await printDirectoryTree(path.join(dir, entry.name), prefix + subPrefix);
      } else {
        console.log(`${prefix}${connector}${chalk.green(entry.name)}`);
      }
    }
  } catch (err) {
    console.log(chalk.red(`Error reading directory: ${err.message}`));
  }
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
 * Main REPL Command Router and Prompt Loop.
 */
export function startRepl() {
  process.stdin.resume();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.bold.cyan('morena > ')
  });

  rl.on('SIGINT', () => {
    console.log(chalk.yellow('\n[-] Use \'exit-now\' to quit Morena.'));
    rl.prompt();
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    session.addHistory(input);
    const [command, ...args] = input.split(/\s+/);

    try {
      switch (command.toLowerCase()) {
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

        case 'show': {
          if (!session.isLocked() || !session.stagingDir) {
            console.log(
              chalk.yellow('[-] No active target or scraped data found. Use \'target <url>\' first, then run \'take\'.')
            );
          } else {
            console.log(chalk.bold.underline(`\nDiscovered Structure for ${session.targetUrl.href}:`));
            console.log(chalk.cyan.bold('/ (staging root)'));
            await printDirectoryTree(session.stagingDir);
            console.log('');
          }
          break;
        }

        case 'take': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }

          const spinner = ora();
          try {
            spinner.start('Launching headless browser and navigating to target...');
            const { html, pageUrl } = await scrapeDOM(session.targetUrl.href, session.timeoutSeconds);
            spinner.succeed(`Scraped final runtime DOM from ${chalk.cyan(pageUrl)}`);

            spinner.start('Hunting and downloading frontend CSS, JS, and image dependencies...');
            const staged = await downloadAndStageAssets(html, pageUrl);
            session.stagingDir = staged.stagingDir;
            session.scrapedData = staged;
            spinner.succeed(`Downloaded ${chalk.bold(staged.assetCount)} frontend asset dependencies`);

            // Interactive prompt for saving archive destination
            rl.pause();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const defaultFilename = `morena-dump-${timestamp}.zip`;
            
            const downloadsFolder = path.join(os.homedir(), 'Downloads');
            let defaultOutputDir = downloadsFolder;
            try {
              await fs.access(downloadsFolder);
            } catch {
              defaultOutputDir = process.cwd();
            }
            const defaultOutputPath = path.join(defaultOutputDir, defaultFilename);
            console.log(chalk.cyan(`\nDefault destination: ${defaultOutputPath}`));

            const destInput = await askQuestion(
              rl,
              chalk.bold.yellow('Specify output ZIP file path (or press Enter for Downloads folder): ')
            );
            rl.resume();

            const finalOutputPath = destInput ? path.resolve(destInput) : defaultOutputPath;
            spinner.start(`Compressing staged frontend assets into archive: ${chalk.bold(finalOutputPath)}...`);
            
            const archiveInfo = await createZipArchive(session.stagingDir, finalOutputPath);
            session.stagingDir = null; // Cleaned up after zipping
            spinner.succeed(chalk.green.bold('[+] Packaging complete! Archive successfully generated.'));

            const formattedSize = (archiveInfo.sizeBytes / (1024 * 1024)).toFixed(2);
            console.log(`${chalk.dim('Destination:')} ${chalk.cyan(archiveInfo.archivePath)}`);
            console.log(`${chalk.dim('Archive Size:')} ${chalk.yellow(`${formattedSize} MB`)} (${archiveInfo.sizeBytes} bytes)\n`);
          } catch (err) {
            if (spinner.isSpinning) spinner.fail(chalk.red('Take operation failed!'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
          }
          break;
        }

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
                session.scrapedData ? session.scrapedData.assetCount : 'Not yet scraped (use \'take\')'
              }`
            );
            console.log(
              `  ${chalk.dim('Staging Status:')}   ${
                session.stagingDir ? session.stagingDir : 'Cleaned / Archived'
              }`
            );
            console.log(chalk.bold.cyan('└──────────────────────────────────────────────────────────┘\n'));
          }
          break;
        }

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

        case 'clean': {
          await session.cleanStaging();
          console.log(chalk.green('[+] Staging directory and temporary caches cleared.'));
          break;
        }

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

        case 'history': {
          console.log(chalk.bold.underline('\nSession Command History:'));
          session.commandHistory.forEach((cmd, idx) => {
            console.log(`  ${chalk.dim(idx + 1 + '.')} ${cmd}`);
          });
          console.log('');
          break;
        }

        case 'help': {
          console.log(chalk.bold.cyan('\nAvailable Morena Commands:'));
          console.log(`  ${chalk.yellow('target <url>')}       - Lock active session target URL`);
          console.log(`  ${chalk.yellow('show')}               - List discovered files & asset folder tree`);
          console.log(`  ${chalk.yellow('take')}               - Scrape DOM, assets & archive to specified zip path`);
          console.log(`  ${chalk.yellow('scession -time')}     - Display session duration since lock`);
          console.log(`  ${chalk.yellow('headers')}            - Fetch target HTTP response headers`);
          console.log(`  ${chalk.yellow('info')}               - Display session status summary card`);
          console.log(`  ${chalk.yellow('set-timeout <sec>')}  - Dynamically set Puppeteer timeout limit`);
          console.log(`  ${chalk.yellow('status')}             - Ping target URL for HTTP status`);
          console.log(`  ${chalk.yellow('clean')}              - Delete temporary staging files`);
          console.log(`  ${chalk.yellow('history')}            - Show executed command history`);
          console.log(`  ${chalk.yellow('exit-now')}           - Clean staging files and terminate shell\n`);
          break;
        }

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
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
