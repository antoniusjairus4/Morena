import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import * as cheerio from 'cheerio';

/**
 * Resolves system Chrome executable path.
 */
async function findChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const paths = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser'];
  for (const p of paths) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // next
    }
  }
  return undefined;
}

/**
 * Discovers all same-origin internal links on the target page.
 *
 * @param {string} targetUrl - The base page URL to scan for links.
 * @param {object[]} cookies - Puppeteer cookies to inject (for authenticated pages).
 * @param {number} timeoutSeconds - Navigation timeout.
 * @returns {Promise<{ path: string, fullUrl: string }[]>}
 */
export async function discoverUrls(targetUrl, cookies = [], timeoutSeconds = 30) {
  let browser;
  try {
    const executablePath = await findChromePath();
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(executablePath && { executablePath })
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Inject cookies if authenticated
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }

    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: timeoutSeconds * 1000
    });

    const baseOrigin = new URL(targetUrl).origin;

    // Extract all anchor hrefs from rendered DOM
    const hrefs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(Boolean);
    });

    // Deduplicate, filter same-origin, normalize
    const seen = new Set();
    const results = [];

    for (const href of hrefs) {
      try {
        const parsed = new URL(href);

        // Skip non-HTTP, fragment-only, or external links
        if (!['http:', 'https:'].includes(parsed.protocol)) continue;
        if (parsed.origin !== baseOrigin) continue;

        // Normalize: remove hash, trailing slash for dedup
        parsed.hash = '';
        let normalized = parsed.href.replace(/\/+$/, '');
        if (normalized === baseOrigin) continue; // Skip the base URL itself

        if (seen.has(normalized)) continue;
        seen.add(normalized);

        const routePath = parsed.pathname || '/';
        results.push({
          path: routePath,
          fullUrl: parsed.href
        });
      } catch {
        // Skip malformed URLs
      }
    }

    // Sort by path for clean display
    results.sort((a, b) => a.path.localeCompare(b.path));
    return results;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Crawls multiple pages and captures their DOM + assets into a staging directory.
 *
 * @param {string[]} urls - Array of full URLs to scrape.
 * @param {object[]} cookies - Puppeteer cookies to inject.
 * @param {number} timeoutSeconds - Navigation timeout.
 * @returns {Promise<{ stagingDir: string, fileList: string[], pagesScraped: number }>}
 */
export async function crawlPages(urls, cookies = [], timeoutSeconds = 30) {
  let browser;
  const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'morena-crawl-'));
  const allFiles = [];

  try {
    const executablePath = await findChromePath();
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(executablePath && { executablePath })
    });

    for (const url of urls) {
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });
        await page.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );

        if (cookies.length > 0) {
          await page.setCookie(...cookies);
        }

        const response = await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: timeoutSeconds * 1000
        });

        if (!response || response.status() >= 400) {
          await page.close();
          continue;
        }

        const html = await page.content();
        const parsed = new URL(url);

        // Create page subdirectory based on route path
        let pageDirName = parsed.pathname.replace(/^\//, '').replace(/\//g, '_') || 'root';
        pageDirName = pageDirName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const pageDir = path.join(stagingDir, 'pages', pageDirName);
        await fs.mkdir(pageDir, { recursive: true });

        // Parse and download assets for this page
        const $ = cheerio.load(html);
        const baseUrl = new URL(url);
        const assetsToDownload = [];
        let assetCounter = 0;

        const processAttr = (selector, attrName, subDir) => {
          $(selector).each((_, el) => {
            const val = $(el).attr(attrName);
            if (!val || val.startsWith('data:') || val.startsWith('#')) return;
            try {
              const absUrl = new URL(val, baseUrl.href).href;
              const parsedAsset = new URL(absUrl);
              let pathname = parsedAsset.pathname;
              if (!pathname || pathname === '/') pathname = `asset_${++assetCounter}`;
              if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);

              const fileName = path.basename(pathname) || `file_${++assetCounter}.bin`;
              const relPath = path.join('assets', subDir, fileName);
              const localPath = path.join(pageDir, relPath);

              $(el).attr(attrName, relPath);
              assetsToDownload.push({ url: absUrl, localPath });
            } catch {
              // skip
            }
          });
        };

        processAttr('link[rel="stylesheet"]', 'href', 'css');
        processAttr('script[src]', 'src', 'js');
        processAttr('img[src]', 'src', 'images');
        processAttr('source[src]', 'src', 'media');
        processAttr('link[rel*="icon"]', 'href', 'icons');

        // Download assets concurrently
        await Promise.all(assetsToDownload.map(async (asset) => {
          try {
            await fs.mkdir(path.dirname(asset.localPath), { recursive: true });
            const res = await fetch(asset.url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            });
            if (!res.ok) return;
            const buffer = Buffer.from(await res.arrayBuffer());
            await fs.writeFile(asset.localPath, buffer);
          } catch {
            // skip failed downloads
          }
        }));

        // Save page HTML
        await fs.writeFile(path.join(pageDir, 'index.html'), $.html(), 'utf8');

        // Track files
        allFiles.push(`pages/${pageDirName}/index.html`);
        for (const asset of assetsToDownload) {
          const rel = path.relative(stagingDir, asset.localPath);
          allFiles.push(rel);
        }

        await page.close();
      } catch {
        // Skip pages that fail to load
      }
    }

    return { stagingDir, fileList: allFiles, pagesScraped: urls.length };
  } finally {
    if (browser) await browser.close();
  }
}
