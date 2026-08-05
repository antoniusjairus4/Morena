import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';

import { validateUrl } from './utils/urlValidator.js';
import { scrapeDOM } from './scraper.js';
import { downloadAndStageAssets } from './assetManager.js';
import { createZipArchive, cleanupStaging } from './archiver.js';

const program = new Command();

program
  .name('morena')
  .alias('palindrome')
  .description('CLI tool for authorized security reconnaissance and frontend asset auditing')
  .argument('<url>', 'Target website URL to inspect and package')
  .option(
    '-o, --output <path>',
    'Output filename/path for resulting zip archive (default: frontend-dump-<timestamp>.zip)'
  )
  .addHelpText(
    'after',
    `\n${chalk.yellow.bold('SAFETY REMINDER & LEGAL DISCLAIMER:')}\n${chalk.yellow(
      'This tool is strictly intended for authorized security assessment, frontend auditing, and web archiving.\nEnsure you have explicit written permission from the target owner before scanning or scraping.'
    )}\n`
  )
  .action(async (rawUrl, options) => {
    let stagingDir = null;
    const spinner = ora();

    try {
      // 1. Validate CLI argument / URL input
      spinner.start('Validating target URL...');
      const targetUrl = validateUrl(rawUrl);
      spinner.succeed(`Target URL validated: ${chalk.cyan(targetUrl.href)}`);

      // 2. Launch Puppeteer and scrape DOM
      spinner.start('Launching headless browser and navigating to target...');
      const { html, pageUrl } = await scrapeDOM(targetUrl.href);
      spinner.succeed(`Scraped final runtime DOM from ${chalk.cyan(pageUrl)}`);

      // 3. Asset discovery & downloading
      spinner.start('Scraping DOM and hunting linked CSS, JS, and image dependencies...');
      const stagingResult = await downloadAndStageAssets(html, pageUrl);
      stagingDir = stagingResult.stagingDir;
      spinner.succeed(
        `Discovered and processed ${chalk.bold(stagingResult.assetCount)} frontend asset dependencies`
      );

      // 4. Determine default or requested ZIP archive path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultFilename = `frontend-dump-${timestamp}.zip`;
      const outputPath = options.output ? options.output : defaultFilename;

      // 5. Compress into single archive
      spinner.start(`Compressing staged frontend assets into archive: ${chalk.bold(outputPath)}...`);
      const { archivePath, sizeBytes } = await createZipArchive(stagingDir, outputPath);
      stagingDir = null; // Cleaned up by archiver module

      const formattedSize = (sizeBytes / (1024 * 1024)).toFixed(2);
      spinner.succeed(chalk.green.bold('Packaging complete! Archive successfully generated.'));

      console.log('\n' + chalk.bold.underline('Dump Summary:'));
      console.log(`${chalk.dim('Target URL:')}    ${targetUrl.href}`);
      console.log(`${chalk.dim('Archive Path:')}  ${chalk.cyan(archivePath)}`);
      console.log(`${chalk.dim('Archive Size:')}  ${chalk.yellow(`${formattedSize} MB`)} (${sizeBytes} bytes)\n`);
    } catch (error) {
      if (spinner.isSpinning) {
        spinner.fail(chalk.red.bold('Operation failed!'));
      }
      console.error(`\n${chalk.red.bold('Error:')} ${error.message}\n`);

      // Clean up staging directory if any error occurred before compression completed
      if (stagingDir) {
        await cleanupStaging(stagingDir);
      }

      process.exit(1);
    }
  });

program.parse(process.argv);
