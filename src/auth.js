import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import { session } from './session.js';

/**
 * Detects if DOM HTML contains a login form, password fields, or login/auth buttons/links.
 * @param {string} html 
 * @returns {boolean}
 */
export function detectLoginForm(html) {
  if (!html) return false;
  const $ = cheerio.load(html);

  // 1. Check for password inputs
  if ($('input[type="password"]').length > 0) return true;

  // 2. Check for login forms
  let found = false;
  $('form').each((_, form) => {
    const text = $(form).text().toLowerCase();
    const action = ($(form).attr('action') || '').toLowerCase();
    const id = ($(form).attr('id') || '').toLowerCase();
    const cls = ($(form).attr('class') || '').toLowerCase();

    if (
      action.includes('login') || action.includes('signin') || action.includes('auth') ||
      id.includes('login') || id.includes('signin') || id.includes('auth') ||
      cls.includes('login') || cls.includes('signin') || cls.includes('auth') ||
      text.includes('sign in') || text.includes('log in') || text.includes('password')
    ) {
      found = true;
    }
  });
  if (found) return true;

  // 3. Check for login/signin buttons or links
  const authRegex = /^(sign in|log in|login|signin|sign-in|log-in)$/i;
  $('button, a, input[type="button"], input[type="submit"]').each((_, el) => {
    const text = $(el).text().trim();
    const val = ($(el).attr('value') || '').trim();
    const href = ($(el).attr('href') || '').trim();

    if (
      authRegex.test(text) || authRegex.test(val) ||
      href.includes('login') || href.includes('signin')
    ) {
      found = true;
    }
  });

  return found;
}

/**
 * Resolves system Chrome executable path across OS environments.
 */
export async function findChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const paths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
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
 * Automated login via form detection.
 */
export async function performLogin(targetUrl, username, password, timeoutSeconds = 30) {
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

    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: timeoutSeconds * 1000
    });

    // Auto-detect username/email field
    const usernameSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[name="user"]',
      'input[name="login"]',
      'input[type="text"][autocomplete="username"]',
      'input[type="text"]'
    ];

    let usernameField = null;
    for (const sel of usernameSelectors) {
      usernameField = await page.$(sel);
      if (usernameField) break;
    }

    if (!usernameField) {
      const authRegex = /^(sign in|log in|login|signin|sign-in|log-in|get started)$/i;
      const clickableElements = await page.$$('button, a, input[type="button"]');
      for (const el of clickableElements) {
        const text = (await page.evaluate(node => node.textContent, el) || '').trim();
        const href = (await page.evaluate(node => node.getAttribute('href'), el) || '').trim();
        if (authRegex.test(text) || href.includes('login') || href.includes('signin')) {
          await el.click().catch(() => {});
          await new Promise(r => setTimeout(r, 1500));
          break;
        }
      }

      for (const sel of usernameSelectors) {
        usernameField = await page.$(sel);
        if (usernameField) break;
      }
    }

    if (!usernameField) {
      return { cookies: [], success: false, error: 'Could not detect username/email input field.' };
    }

    const passwordField = await page.$('input[type="password"]');
    if (!passwordField) {
      return { cookies: [], success: false, error: 'Could not detect password input field.' };
    }

    await usernameField.click({ clickCount: 3 });
    await usernameField.type(username, { delay: 50 });
    await passwordField.click({ clickCount: 3 });
    await passwordField.type(password, { delay: 50 });

    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:not([type="button"])',
      'button'
    ];

    let submitted = false;
    for (const sel of submitSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: timeoutSeconds * 1000 }).catch(() => {}),
          btn.click()
        ]);
        submitted = true;
        break;
      }
    }

    if (!submitted) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: timeoutSeconds * 1000 }).catch(() => {}),
        page.keyboard.press('Enter')
      ]);
    }

    await new Promise(r => setTimeout(r, 2000));

    await session.captureBrowserState(page);
    return {
      cookies: session.cookies,
      localStorage: session.localStorageData,
      sessionStorage: session.sessionStorageData,
      success: session.isAuthenticated()
    };
  } catch (error) {
    return { cookies: [], localStorage: {}, sessionStorage: {}, success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Interactive (visible) browser login with full state capture.
 * Opens a non-headless Chrome window for the user to log in manually.
 * Snapshots cookies and Web Storage into session singleton upon completion.
 *
 * @param {string} targetUrl - The page URL to open.
 * @param {Function} waitForContinue - Async function that resolves when user signals completion.
 * @param {number} timeoutSeconds - Navigation timeout.
 * @returns {Promise<{ cookies: object[], localStorage: object, sessionStorage: object, success: boolean, error?: string }>}
 */
export async function interactiveLogin(targetUrl, waitForContinue, timeoutSeconds = 30) {
  let browser;
  try {
    const url = targetUrl || (session.targetUrl ? session.targetUrl.href : null);
    if (!url) {
      return { cookies: [], localStorage: {}, sessionStorage: {}, success: false, error: 'No target URL set.' };
    }

    const executablePath = await findChromePath();
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
      ...(executablePath && { executablePath })
    });

    const page = await browser.newPage();

    // If partial session state exists, apply it
    await session.applyBrowserState(page);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: timeoutSeconds * 1000
    });

    // Wait for user to complete manual login in the visible browser
    await waitForContinue();

    await new Promise(r => setTimeout(r, 1500));

    // Capture cookies, localStorage, and sessionStorage directly into session singleton
    await session.captureBrowserState(page);
    if (page.url()) {
      session.setTarget(page.url());
    }

    return {
      cookies: session.cookies,
      localStorage: session.localStorageData,
      sessionStorage: session.sessionStorageData,
      success: session.isAuthenticated()
    };
  } catch (error) {
    return { cookies: [], localStorage: {}, sessionStorage: {}, success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}
