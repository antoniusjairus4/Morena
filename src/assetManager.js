import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import * as cheerio from 'cheerio';

/**
 * Parses DOM HTML, extracts linked CSS/JS/Image resources, downloads them,
 * recreates local file structures, rewrites DOM HTML attributes, and saves index.html.
 * 
 * @param {string} rawHtml - DOM HTML string.
 * @param {string} pageUrl - Base URL of the page.
 * @returns {Promise<{ stagingDir: string, assetCount: number }>}
 */
export async function downloadAndStageAssets(rawHtml, pageUrl) {
  const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'morena-dump-'));
  const $ = cheerio.load(rawHtml);
  const baseUrl = new URL(pageUrl);

  const assetsToDownload = [];
  let assetCounter = 0;

  // Utility to register asset for download & relative rewriting
  const processElementAttr = (selector, attrName, subDir) => {
    $(selector).each((_, element) => {
      const srcVal = $(element).attr(attrName);
      if (!srcVal || srcVal.startsWith('data:') || srcVal.startsWith('#')) return;

      try {
        const absoluteUrl = new URL(srcVal, baseUrl.href).href;
        const parsedUrl = new URL(absoluteUrl);

        // Sanitize path for local filesystem saving
        let pathname = parsedUrl.pathname;
        if (!pathname || pathname === '/') {
          pathname = `asset_${++assetCounter}`;
        }
        
        // Clean trailing slash
        if (pathname.endsWith('/')) {
          pathname = pathname.slice(0, -1);
        }

        const ext = path.extname(pathname);
        const fileName = path.basename(pathname) || `file_${++assetCounter}${ext || '.bin'}`;
        const relativeLocalPath = path.join('assets', subDir, `${Date.now()}_${assetCounter}_${fileName}`);
        const localStagingPath = path.join(stagingDir, relativeLocalPath);

        // Rewrite element attribute to offline relative path
        $(element).attr(attrName, relativeLocalPath);

        assetsToDownload.push({
          url: absoluteUrl,
          localPath: localStagingPath
        });
      } catch {
        // Skip invalid URL references gracefully
      }
    });
  };

  // Extract CSS, JS, and Image resources
  processElementAttr('link[rel="stylesheet"]', 'href', 'css');
  processElementAttr('script[src]', 'src', 'js');
  processElementAttr('img[src]', 'src', 'images');
  processElementAttr('source[src]', 'src', 'media');
  processElementAttr('link[rel*="icon"]', 'href', 'icons');

  // Concurrently download assets with error tolerance
  const downloadPromises = assetsToDownload.map(async (asset) => {
    try {
      await fs.mkdir(path.dirname(asset.localPath), { recursive: true });
      const res = await fetch(asset.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      if (!res.ok) return;

      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(asset.localPath, buffer);
    } catch {
      // Ignore individual asset download errors gracefully
    }
  });

  await Promise.all(downloadPromises);

  // Save reconstructed offline index.html
  const indexPath = path.join(stagingDir, 'index.html');
  await fs.writeFile(indexPath, $.html(), 'utf8');

  return {
    stagingDir,
    assetCount: assetsToDownload.length
  };
}
