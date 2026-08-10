import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import * as cheerio from 'cheerio';
import { findChromePath } from './auth.js';
import { session } from './session.js';

/**
 * Creates a Puppeteer page instance with session cookies & storage pre-injected.
 */
export async function createAuthenticatedPage() {
  const executablePath = await findChromePath();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...(executablePath && { executablePath })
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  await session.applyBrowserState(page);
  return { browser, page };
}

/**
 * Discovers all same-origin internal links on the target page.
 *
 * @param {string} targetUrl - The base page URL to scan for links.
 * @param {object[]} cookies - Optional cookies (uses session if empty).
 * @param {object} localStorageData - Optional localStorage (uses session if empty).
 * @param {object} sessionStorageData - Optional sessionStorage (uses session if empty).
 * @param {number} timeoutSeconds - Navigation timeout.
 * @returns {Promise<{ path: string, fullUrl: string }[]>}
 */
export async function discoverUrls(targetUrl, cookies = [], localStorageData = {}, sessionStorageData = {}, timeoutSeconds = 30) {
  const urlToScan = targetUrl || (session.targetUrl ? session.targetUrl.href : null);
  if (!urlToScan) {
    console.log('[-] Error: No target URL specified.');
    return [];
  }

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

    // Apply custom parameters or fallback to global session state
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
    }
    if ((localStorageData && Object.keys(localStorageData).length > 0) || (sessionStorageData && Object.keys(sessionStorageData).length > 0)) {
      await page.evaluateOnNewDocument((local, session) => {
        if (local) {
          for (const [k, v] of Object.entries(local)) {
            try { localStorage.setItem(k, v); } catch {}
          }
        }
        if (session) {
          for (const [k, v] of Object.entries(session)) {
            try { sessionStorage.setItem(k, v); } catch {}
          }
        }
      }, localStorageData, sessionStorageData);
    } else {
      await session.applyBrowserState(page);
    }

    await page.goto(urlToScan, {
      waitUntil: 'networkidle2',
      timeout: timeoutSeconds * 1000
    });

    // Allow SPA hydration to complete
    await new Promise(r => setTimeout(r, 1500));

    const baseOrigin = new URL(urlToScan).origin;

    // 1. Extract DOM links, data attributes, inline scripts, and script bundle URLs
    const { hrefs: domHrefs, scriptSrcs } = await page.evaluate(() => {
      const links = new Set();
      const scripts = new Set();

      // Traditional <a> tags
      document.querySelectorAll('a[href]').forEach(a => {
        if (a.href) links.add(a.href);
      });

      // Data attributes & navigation elements
      document.querySelectorAll('[data-href], [data-route], [data-url], [role="link"]').forEach(el => {
        const val = el.getAttribute('data-href') || el.getAttribute('data-route') || el.getAttribute('data-url');
        if (val) {
          try {
            links.add(new URL(val, location.origin).href);
          } catch {}
        }
      });

      // Extract scripts from DOM and performance resources
      document.querySelectorAll('script').forEach(s => {
        if (s.src) {
          try {
            scripts.add(new URL(s.src, location.origin).href);
          } catch {}
        } else {
          const text = s.textContent || '';
          const matches = text.match(/["'\`](\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)["'\`]/g);
          if (matches) {
            matches.forEach(m => {
              const clean = m.replace(/['"`]/g, '');
              if (clean.length > 1 && !clean.startsWith('//') && !clean.includes('.') && !clean.startsWith('/api')) {
                links.add(location.origin + clean);
              }
            });
          }
        }
      });

      try {
        performance.getEntriesByType('resource').forEach(r => {
          if (r.name && (r.name.includes('.js') || r.initiatorType === 'script')) {
            try {
              scripts.add(new URL(r.name, location.origin).href);
            } catch {}
          }
        });
      } catch {}

      return { hrefs: Array.from(links), scriptSrcs: Array.from(scripts) };
    });

    const allHrefs = new Set(domHrefs);

    // Scan full raw HTML source for inline route strings
    try {
      const html = await page.content();
      const htmlMatches = html.match(/["'\`](\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)["'\`]/g);
      if (htmlMatches) {
        htmlMatches.forEach(m => {
          const clean = m.replace(/['"`]/g, '');
          if (
            clean.length > 1 &&
            !clean.startsWith('//') &&
            !clean.includes('.') &&
            !clean.startsWith('/api') &&
            !clean.startsWith('/assets') &&
            !clean.startsWith('/static')
          ) {
            allHrefs.add(baseOrigin + clean);
          }
        });
      }
    } catch {}

    // 2. Fetch and scan external JS script bundles for client-side SPA routes
    for (const src of scriptSrcs) {
      try {
        const res = await fetch(src);
        if (!res.ok) continue;
        const text = await res.text();
        const matches = text.match(/["'\`](\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)["'\`]/g);
        if (matches) {
          matches.forEach(m => {
            const clean = m.replace(/['"`]/g, '');
            if (
              clean.length > 1 &&
              !clean.startsWith('//') &&
              !clean.includes('.') &&
              !clean.startsWith('/api') &&
              !clean.startsWith('/assets') &&
              !clean.startsWith('/static')
            ) {
              allHrefs.add(baseOrigin + clean);
            }
          });
        }
      } catch {
        // Skip failed script fetches
      }
    }

    // Deduplicate, filter same-origin, normalize
    const seen = new Set();
    const results = [];

    for (const href of allHrefs) {
      try {
        const parsed = new URL(href);

        if (!['http:', 'https:'].includes(parsed.protocol)) continue;
        if (parsed.origin !== baseOrigin) continue;

        parsed.hash = '';
        let normalized = parsed.href.replace(/\/+$/, '');
        if (normalized === baseOrigin) continue;

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

    results.sort((a, b) => a.path.localeCompare(b.path));
    session.setDiscoveredUrls(results);
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
 * @param {object} localStorageData - localStorage object.
 * @param {object} sessionStorageData - sessionStorage object.
 * @param {number} timeoutSeconds - Navigation timeout.
 * @returns {Promise<{ stagingDir: string, fileList: string[], pagesScraped: number }>}
 */
export async function crawlPages(urls, cookies = [], localStorageData = {}, sessionStorageData = {}, timeoutSeconds = 30) {
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

        if (cookies && cookies.length > 0) {
          await page.setCookie(...cookies);
        }

        if ((localStorageData && Object.keys(localStorageData).length > 0) || (sessionStorageData && Object.keys(sessionStorageData).length > 0)) {
          await page.evaluateOnNewDocument((local, session) => {
            if (local) {
              for (const [k, v] of Object.entries(local)) {
                try { localStorage.setItem(k, v); } catch {}
              }
            }
            if (session) {
              for (const [k, v] of Object.entries(session)) {
                try { sessionStorage.setItem(k, v); } catch {}
              }
            }
          }, localStorageData, sessionStorageData);
        } else {
          await session.applyBrowserState(page);
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

        let pageDirName = parsed.pathname.replace(/^\//, '').replace(/\//g, '_') || 'root';
        pageDirName = pageDirName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const pageDir = path.join(stagingDir, 'pages', pageDirName);
        await fs.mkdir(pageDir, { recursive: true });

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

        await fs.writeFile(path.join(pageDir, 'index.html'), $.html(), 'utf8');

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
