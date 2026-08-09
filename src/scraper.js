import puppeteer from 'puppeteer';
import fs from 'fs/promises';

/**
 * Launches Puppeteer, navigates to target URL, waits for network idle,
 * and extracts the final runtime DOM HTML.
 * 
 * @param {string} targetUrl - The target URL to navigate to.
 * @param {number} timeoutSeconds - Page load timeout in seconds.
 * @param {object[]} cookies - Optional Puppeteer cookies to inject before navigation.
 * @returns {Promise<{ html: string, pageUrl: string }>}
 */
export async function scrapeDOM(targetUrl, timeoutSeconds = 30, cookies = [], localStorageData = {}, sessionStorageData = {}) {
  let browser;
  try {
    // Launch Puppeteer with system Chrome executable or fallback to default
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      // Common system chrome paths on Linux
      const systemChromePaths = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser'];
      for (const chromePath of systemChromePaths) {
        try {
          await fs.access(chromePath);
          launchOptions.executablePath = chromePath;
          break;
        } catch {
          // Path doesn't exist, try next
        }
      }
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Inject session cookies if provided
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
    }

    // Inject storage if authenticated
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
    }

    // Navigate to URL and wait until network is idle (networkidle2)
    const response = await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: timeoutSeconds * 1000
    });

    if (!response) {
      throw new Error(`Failed to receive response from ${targetUrl}`);
    }

    const status = response.status();
    if (status >= 400) {
      throw new Error(`HTTP ${status} error response from ${targetUrl}`);
    }

    const html = await page.content();
    const finalUrl = page.url();

    return { html, pageUrl: finalUrl };
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error(`Navigation timed out after ${timeoutSeconds} seconds while loading ${targetUrl}`);
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
