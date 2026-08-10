import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import { session } from './session.js';
import { findChromePath } from './auth.js';

/**
 * Launches Puppeteer, navigates to target URL, waits for network idle,
 * and extracts the final runtime DOM HTML.
 * 
 * @param {string} targetUrl - The target URL to navigate to.
 * @param {number} timeoutSeconds - Page load timeout in seconds.
 * @param {object[]} cookies - Optional Puppeteer cookies to inject before navigation.
 * @param {object} localStorageData - Optional localStorage object.
 * @param {object} sessionStorageData - Optional sessionStorage object.
 * @returns {Promise<{ html: string, pageUrl: string }>}
 */
export async function scrapeDOM(targetUrl, timeoutSeconds = 30, cookies = [], localStorageData = {}, sessionStorageData = {}) {
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

    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
    }

    if ((localStorageData && Object.keys(localStorageData).length > 0) || (sessionStorageData && Object.keys(sessionStorageData).length > 0)) {
      await page.evaluateOnNewDocument((local, sessionData) => {
        if (local) {
          for (const [k, v] of Object.entries(local)) {
            try { localStorage.setItem(k, v); } catch {}
          }
        }
        if (sessionData) {
          for (const [k, v] of Object.entries(sessionData)) {
            try { sessionStorage.setItem(k, v); } catch {}
          }
        }
      }, localStorageData, sessionStorageData);
    } else {
      await session.applyBrowserState(page);
    }

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
