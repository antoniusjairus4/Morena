import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import inquirer from 'inquirer';

import { session } from './session.js';
import { validateUrl } from './utils/urlValidator.js';
import { scrapeDOM } from './scraper.js';
import { downloadAndStageAssets } from './assetManager.js';
import { createZipArchive } from './archiver.js';
import { performLogin, interactiveLogin, detectLoginForm } from './auth.js';
import { discoverUrls, crawlPages } from './crawler.js';

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
 * Masked password input.
 */
function askPassword(rl, query) {
  return new Promise((resolve) => {
    rl.pause();
    const stdoutWrite = process.stdout.write.bind(process.stdout);
    let password = '';

    process.stdout.write(query);
    const stdinHandler = (data) => {
      const char = data.toString();
      if (char === '\n' || char === '\r') {
        process.stdin.removeListener('data', stdinHandler);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdout.write('\n');
        resolve(password);
      } else if (char === '\u007F' || char === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdoutWrite('\b \b');
        }
      } else if (char === '\u0003') {
        // Ctrl+C
        process.stdin.removeListener('data', stdinHandler);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdout.write('\n');
        resolve('');
      } else {
        password += char;
        stdoutWrite('*');
      }
    };

    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', stdinHandler);
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
        // LOGIN (automated form login)
        // ──────────────────────────────────────────────
        case 'login': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }
          if (session.isAuthenticated()) {
            console.log(chalk.yellow('[-] Already authenticated. Use \'exit-now\' to reset session.'));
            break;
          }

          rl.pause();
          const username = await askQuestion(rl, chalk.bold.yellow('Username / Email: '));
          const password = await askPassword(rl, chalk.bold.yellow('Password: '));
          rl.resume();

          if (!username || !password) {
            console.log(chalk.red('[-] Username and password are required.'));
            break;
          }

          const spinner = ora('Attempting automated login...').start();
          const result = await performLogin(session.targetUrl.href, username, password, session.timeoutSeconds);

          if (result.success) {
            session.setCookies(result.cookies);
            spinner.succeed(chalk.green.bold(`[+] Authenticated successfully. ${result.cookies.length} session cookies captured automatically.`));
          } else {
            spinner.fail(chalk.red(`[-] Login failed: ${result.error}`));
            console.log(chalk.yellow('    Try \'interactive\' for manual browser login.'));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // INTERACTIVE (visible browser manual login)
        // ──────────────────────────────────────────────
        case 'interactive': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }

          console.log(chalk.cyan('[*] Opening browser window... Log in manually, then type \'continue\' here.'));

          rl.pause();

          const waitForContinue = () => {
            return new Promise((resolve) => {
              rl.pause();
              process.stdout.write(chalk.bold.yellow('\nType \'continue\' when you have logged in: '));
              const handler = (data) => {
                const input = data.toString().trim().toLowerCase();
                if (input.includes('continue')) {
                  process.stdin.removeListener('data', handler);
                  resolve();
                }
              };
              process.stdin.resume();
              process.stdin.on('data', handler);
            });
          };

          const result = await interactiveLogin(session.targetUrl.href, waitForContinue, session.timeoutSeconds);
          rl.resume();

          if (result.success) {
            session.setCookies(result.cookies);
            console.log(chalk.green.bold(`[+] Session captured from browser. ${result.cookies.length} cookies stored automatically.`));
          } else {
            console.log(chalk.red(`[-] Interactive login failed: ${result.error || 'No cookies captured.'}`));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // FIND (discover internal URLs/routes)
        // ──────────────────────────────────────────────
        case 'find': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }

          const spinner = ora('Scanning target for internal routes and links...').start();
          try {
            const urls = await discoverUrls(session.targetUrl.href, session.cookies, session.timeoutSeconds);
            session.setDiscoveredUrls(urls);
            spinner.succeed(`Discovered ${chalk.bold(urls.length)} internal route(s)`);

            if (urls.length === 0) {
              console.log(chalk.yellow('    No internal links found on this page.'));
            } else {
              console.log(chalk.bold.underline('\nDiscovered Routes:'));
              urls.forEach((u, i) => {
                console.log(`  ${chalk.dim(String(i + 1).padStart(3, ' ') + '.')} ${chalk.cyan(u.path)} ${chalk.dim('→')} ${u.fullUrl}`);
              });
              console.log('');
            }
          } catch (err) {
            spinner.fail(chalk.red('URL discovery failed.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
          }
          break;
        }

        // ──────────────────────────────────────────────
        // CRAWL <page> (scrape a specific discovered route)
        // ──────────────────────────────────────────────
        case 'crawl': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }
          if (session.discoveredUrls.length === 0) {
            console.log(chalk.yellow('[-] No routes discovered yet. Run \'find\' first.'));
            break;
          }

          const query = args.join(' ').toLowerCase();
          if (!query) {
            console.log(chalk.red('[-] Usage: crawl <page-name>  (e.g., crawl dashboard)'));
            break;
          }

          // Find matching route
          const match = session.discoveredUrls.find(u =>
            u.path.toLowerCase().includes(query) || u.fullUrl.toLowerCase().includes(query)
          );

          if (!match) {
            console.log(chalk.red(`[-] No discovered route matches '${query}'. Run 'find' to see available routes.`));
            break;
          }

          const spinner = ora(`Crawling ${match.path}...`).start();
          try {
            const result = await crawlPages([match.fullUrl], session.cookies, session.timeoutSeconds);
            session.stagingDir = result.stagingDir;
            session.scrapedFilesList = [...session.scrapedFilesList, ...result.fileList];
            spinner.succeed(`Crawled ${chalk.cyan(match.path)} — ${result.fileList.length} file(s) captured`);

            // Archive
            const defaultOutput = await getDefaultOutputPath(`morena-crawl-${query}`);
            rl.pause();
            const dest = await askQuestion(rl, chalk.bold.yellow(`Save archive to (Enter for ${defaultOutput}): `));
            rl.resume();
            const outputPath = dest ? path.resolve(dest) : defaultOutput;

            const archiveSpinner = ora('Compressing...').start();
            const archive = await createZipArchive(result.stagingDir, outputPath);
            session.stagingDir = null;
            archiveSpinner.succeed(chalk.green.bold('[+] Archive generated.'));

            const sizeMB = (archive.sizeBytes / (1024 * 1024)).toFixed(2);
            console.log(`${chalk.dim('Destination:')} ${chalk.cyan(archive.archivePath)}`);
            console.log(`${chalk.dim('Size:')} ${chalk.yellow(`${sizeMB} MB`)} (${archive.sizeBytes} bytes)\n`);
          } catch (err) {
            spinner.fail(chalk.red('Crawl failed.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
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
        // TAKE (with interactive selector & take -all)
        // ──────────────────────────────────────────────
        case 'take': {
          if (!session.isLocked()) {
            console.log(chalk.yellow('[-] No target locked. Use \'target <url>\' first.'));
            break;
          }

          const isAll = args[0] === '-all';

          // Step 1: Scrape current page
          const spinner = ora();
          let currentHtml, currentPageUrl;
          try {
            spinner.start('Launching headless browser and navigating to target...');
            const result = await scrapeDOM(session.targetUrl.href, session.timeoutSeconds, session.cookies);
            currentHtml = result.html;
            currentPageUrl = result.pageUrl;
            spinner.succeed(`Scraped final runtime DOM from ${chalk.cyan(currentPageUrl)}`);
          } catch (err) {
            spinner.fail(chalk.red('Scraping failed.'));
            console.log(chalk.red(`[-] Error: ${err.message}`));
            break;
          }

          // Pre-scrape Login Form Detection
          if (!session.isAuthenticated() && detectLoginForm(currentHtml)) {
            console.log(chalk.bold.yellow('\n[!] Login form detected on target page!'));
            rl.pause();
            process.stdin.setRawMode && process.stdin.setRawMode(false);

            try {
              const { authChoice } = await inquirer.prompt([
                {
                  type: 'list',
                  name: 'authChoice',
                  message: 'A login form was detected. How would you like to proceed?',
                  choices: [
                    { name: '● Scrape current public page only (without logging in)', value: 'public' },
                    { name: '● Log in first (automated credentials), then scrape fully', value: 'auto_login' },
                    { name: '● Log in manually (interactive browser window), then scrape fully', value: 'manual_login' }
                  ]
                }
              ]);

              if (authChoice === 'auto_login') {
                const username = await askQuestion(rl, chalk.bold.yellow('Username / Email: '));
                const password = await askPassword(rl, chalk.bold.yellow('Password: '));
                if (username && password) {
                  const loginSpinner = ora('Attempting automated login...').start();
                  const loginRes = await performLogin(session.targetUrl.href, username, password, session.timeoutSeconds);
                  if (loginRes.success) {
                    session.setCookies(loginRes.cookies);
                    loginSpinner.succeed(chalk.green.bold(`[+] Authenticated successfully. ${loginRes.cookies.length} session cookies captured.`));
                    // Re-scrape DOM with authenticated session cookies
                    spinner.start('Re-scraping DOM in authenticated state...');
                    const result = await scrapeDOM(session.targetUrl.href, session.timeoutSeconds, session.cookies);
                    currentHtml = result.html;
                    currentPageUrl = result.pageUrl;
                    spinner.succeed(`Captured authenticated DOM from ${chalk.cyan(currentPageUrl)}`);
                  } else {
                    loginSpinner.fail(chalk.red(`[-] Login failed: ${loginRes.error}. Proceeding with public page.`));
                  }
                }
              } else if (authChoice === 'manual_login') {
                console.log(chalk.cyan('[*] Opening browser window... Log in manually, then type \'continue\' here.'));
                const waitForContinue = () => {
                  return new Promise((resolve) => {
                    const handler = (data) => {
                      const input = data.toString().trim().toLowerCase();
                      if (input === 'continue') {
                        process.stdin.removeListener('data', handler);
                        resolve();
                      }
                    };
                    process.stdin.setRawMode(false);
                    process.stdin.resume();
                    process.stdin.on('data', handler);
                    process.stdout.write(chalk.bold.yellow('\nType \'continue\' when you have logged in: '));
                  });
                };
                const loginRes = await interactiveLogin(session.targetUrl.href, waitForContinue, session.timeoutSeconds);
                if (loginRes.success) {
                  session.setCookies(loginRes.cookies);
                  console.log(chalk.green.bold(`[+] Session captured from browser. ${loginRes.cookies.length} cookies stored.`));
                  // Re-scrape DOM with authenticated session cookies
                  spinner.start('Re-scraping DOM in authenticated state...');
                  const result = await scrapeDOM(session.targetUrl.href, session.timeoutSeconds, session.cookies);
                  currentHtml = result.html;
                  currentPageUrl = result.pageUrl;
                  spinner.succeed(`Captured authenticated DOM from ${chalk.cyan(currentPageUrl)}`);
                } else {
                  console.log(chalk.red('[-] Manual login failed or no cookies captured. Proceeding with public page.'));
                }
              }
            } catch (err) {
              console.log(chalk.red(`[-] Prompt error: ${err.message}`));
            }

            rl.resume();
          }

          // Step 2: Download assets for current page
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

          // Step 3: If take -all, scrape everything
          if (isAll) {
            if (session.discoveredUrls.length === 0) {
              spinner.start('Discovering internal routes for full scrape...');
              try {
                const urls = await discoverUrls(session.targetUrl.href, session.cookies, session.timeoutSeconds);
                session.setDiscoveredUrls(urls);
                spinner.succeed(`Found ${urls.length} internal route(s)`);
              } catch {
                spinner.succeed('No additional routes found. Archiving current page only.');
              }
            }

            if (session.discoveredUrls.length > 0) {
              spinner.start(`Crawling ${session.discoveredUrls.length} additional pages...`);
              try {
                const allUrls = session.discoveredUrls.map(u => u.fullUrl);
                const crawlResult = await crawlPages(allUrls, session.cookies, session.timeoutSeconds);
                session.scrapedFilesList = [...session.scrapedFilesList, ...crawlResult.fileList];

                // Merge crawled staging into main staging
                const crawledEntries = await fs.readdir(crawlResult.stagingDir, { withFileTypes: true });
                for (const entry of crawledEntries) {
                  const src = path.join(crawlResult.stagingDir, entry.name);
                  const dest = path.join(staged.stagingDir, entry.name);
                  await fs.cp(src, dest, { recursive: true });
                }
                await fs.rm(crawlResult.stagingDir, { recursive: true, force: true });
                spinner.succeed(`Crawled ${chalk.bold(session.discoveredUrls.length)} additional page(s)`);
              } catch (err) {
                spinner.fail(chalk.red('Multi-page crawl partially failed.'));
                console.log(chalk.red(`[-] Error: ${err.message}`));
              }
            }

            // Archive everything
            const defaultOutput = await getDefaultOutputPath('morena-full-dump');
            rl.pause();
            const dest = await askQuestion(rl, chalk.bold.yellow(`Save archive to (Enter for ${defaultOutput}): `));
            rl.resume();
            const outputPath = dest ? path.resolve(dest) : defaultOutput;

            spinner.start(`Compressing all scraped pages into archive...`);
            const archive = await createZipArchive(session.stagingDir, outputPath);
            session.stagingDir = null;
            spinner.succeed(chalk.green.bold('[+] Packaging complete! Full archive generated.'));

            const sizeMB = (archive.sizeBytes / (1024 * 1024)).toFixed(2);
            console.log(`${chalk.dim('Destination:')} ${chalk.cyan(archive.archivePath)}`);
            console.log(`${chalk.dim('Size:')} ${chalk.yellow(`${sizeMB} MB`)} (${archive.sizeBytes} bytes)\n`);
            break;
          }

          // Step 4: Check for other pages (non -all mode)
          if (session.discoveredUrls.length === 0) {
            // Auto-discover
            try {
              const urls = await discoverUrls(session.targetUrl.href, session.cookies, session.timeoutSeconds);
              session.setDiscoveredUrls(urls);
            } catch {
              // No routes found — proceed with single page
            }
          }

          if (session.discoveredUrls.length > 0) {
            console.log(chalk.cyan(`\n[*] ${session.discoveredUrls.length} other page(s) discovered on this target.`));

            // Close readline temporarily for inquirer
            rl.pause();
            process.stdin.setRawMode && process.stdin.setRawMode(false);

            try {
              const { action } = await inquirer.prompt([
                {
                  type: 'list',
                  name: 'action',
                  message: 'What would you like to do?',
                  choices: [
                    { name: '● Scrape current page only', value: 'current' },
                    { name: '● Select specific pages to scrape', value: 'select' },
                    { name: '● Scrape ALL discovered pages', value: 'all' }
                  ]
                }
              ]);

              if (action === 'select') {
                const { selectedPages } = await inquirer.prompt([
                  {
                    type: 'checkbox',
                    name: 'selectedPages',
                    message: 'Select pages to scrape (use Space to select, Enter to confirm):',
                    choices: session.discoveredUrls.map(u => ({
                      name: `${u.path} → ${u.fullUrl}`,
                      value: u.fullUrl
                    }))
                  }
                ]);

                if (selectedPages.length > 0) {
                  const sp = ora(`Crawling ${selectedPages.length} selected page(s)...`).start();
                  try {
                    const crawlResult = await crawlPages(selectedPages, session.cookies, session.timeoutSeconds);
                    session.scrapedFilesList = [...session.scrapedFilesList, ...crawlResult.fileList];

                    const crawledEntries = await fs.readdir(crawlResult.stagingDir, { withFileTypes: true });
                    for (const entry of crawledEntries) {
                      const src = path.join(crawlResult.stagingDir, entry.name);
                      const dest = path.join(staged.stagingDir, entry.name);
                      await fs.cp(src, dest, { recursive: true });
                    }
                    await fs.rm(crawlResult.stagingDir, { recursive: true, force: true });
                    sp.succeed(`Crawled ${chalk.bold(selectedPages.length)} selected page(s)`);
                  } catch (err) {
                    sp.fail(chalk.red('Multi-page crawl failed.'));
                    console.log(chalk.red(`[-] Error: ${err.message}`));
                  }
                }
              } else if (action === 'all') {
                const sp = ora(`Crawling ${session.discoveredUrls.length} page(s)...`).start();
                try {
                  const allUrls = session.discoveredUrls.map(u => u.fullUrl);
                  const crawlResult = await crawlPages(allUrls, session.cookies, session.timeoutSeconds);
                  session.scrapedFilesList = [...session.scrapedFilesList, ...crawlResult.fileList];

                  const crawledEntries = await fs.readdir(crawlResult.stagingDir, { withFileTypes: true });
                  for (const entry of crawledEntries) {
                    const src = path.join(crawlResult.stagingDir, entry.name);
                    const dest = path.join(staged.stagingDir, entry.name);
                    await fs.cp(src, dest, { recursive: true });
                  }
                  await fs.rm(crawlResult.stagingDir, { recursive: true, force: true });
                  sp.succeed(`Crawled ${chalk.bold(session.discoveredUrls.length)} page(s)`);
                } catch (err) {
                  sp.fail(chalk.red('Full crawl failed.'));
                  console.log(chalk.red(`[-] Error: ${err.message}`));
                }
              }
              // action === 'current' → just archive current page
            } catch (err) {
              console.log(chalk.red(`[-] Selector error: ${err.message}`));
            }

            rl.resume();
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
            console.log(`  ${chalk.dim('Authenticated:')}    ${session.isAuthenticated() ? chalk.green('Yes (' + session.cookies.length + ' cookies)') : chalk.yellow('No')}`);
            console.log(`  ${chalk.dim('Routes Found:')}     ${session.discoveredUrls.length > 0 ? chalk.green(session.discoveredUrls.length + ' route(s)') : 'Not scanned (use \'find\')'}`);
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
          console.log(chalk.dim('  ── Authentication ──'));
          console.log(`  ${chalk.yellow('login')}              - Automated form login (prompts for credentials)`);
          console.log(`  ${chalk.yellow('interactive')}        - Open visible browser for manual login`);
          console.log(chalk.dim('  ── Discovery & Scraping ──'));
          console.log(`  ${chalk.yellow('find')}               - Discover all internal routes on the target`);
          console.log(`  ${chalk.yellow('crawl <page>')}       - Scrape a specific discovered route`);
          console.log(`  ${chalk.yellow('take')}               - Scrape current page (with page selector if routes found)`);
          console.log(`  ${chalk.yellow('take -all')}          - Scrape current page + ALL discovered routes`);
          console.log(`  ${chalk.yellow('show')}               - Display hierarchical tree of scraped files`);
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
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
