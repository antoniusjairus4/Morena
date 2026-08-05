import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';

/**
 * Detects if DOM HTML contains a login form or password input fields.
 * @param {string} html 
 * @returns {boolean}
 */
export function detectLoginForm(html) {
  if (!html) return false;
  const $ = cheerio.load(html);

  if ($('input[type="password"]').length > 0) return true;

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

  return found;
}

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
 * Automated login via form detection.
 * Navigates to targetUrl, finds username/password inputs, fills them, submits,
 * and captures all cookies from the authenticated session.
 *
 * @param {string} targetUrl - The login page URL.
 * @param {string} username - Username or email.
 * @param {string} password - Password.
 * @param {number} timeoutSeconds - Navigation timeout.
 * @returns {Promise<{ cookies: object[], success: boolean, error?: string }>}
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
      return { cookies: [], success: false, error: 'Could not detect username/email input field.' };
    }

    // Auto-detect password field
    const passwordField = await page.$('input[type="password"]');
    if (!passwordField) {
      return { cookies: [], success: false, error: 'Could not detect password input field.' };
    }

    // Fill credentials
    await usernameField.click({ clickCount: 3 });
    await usernameField.type(username, { delay: 50 });
    await passwordField.click({ clickCount: 3 });
    await passwordField.type(password, { delay: 50 });

    // Find and click submit button
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
      // Fallback: press Enter on password field
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: timeoutSeconds * 1000 }).catch(() => {}),
        page.keyboard.press('Enter')
      ]);
    }

    // Wait a moment for any redirects to settle
    await new Promise(r => setTimeout(r, 2000));

    const cookies = await page.cookies();
    if (cookies.length === 0) {
      return { cookies: [], success: false, error: 'Login may have failed — no session cookies captured.' };
    }

    return { cookies, success: true };
  } catch (error) {
    return { cookies: [], success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Interactive (visible) browser login.
 * Opens a non-headless Chrome window for the user to log in manually.
 * Returns captured cookies once the user signals completion.
 *
 * @param {string} targetUrl - The page URL to open.
 * @param {Function} waitForContinue - Async function that resolves when user types 'continue'.
 * @param {number} timeoutSeconds - Navigation timeout.
 * @returns {Promise<{ cookies: object[], success: boolean, error?: string }>}
 */
export async function interactiveLogin(targetUrl, waitForContinue, timeoutSeconds = 30) {
  let browser;
  try {
    const executablePath = await findChromePath();
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
      defaultViewport: null,
      ...(executablePath && { executablePath })
    });

    const page = await browser.newPage();
    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: timeoutSeconds * 1000
    });

    // Wait for user to manually log in and type 'continue'
    await waitForContinue();

    // Small delay to ensure page state is settled
    await new Promise(r => setTimeout(r, 1500));

    const cookies = await page.cookies();
    return { cookies, success: cookies.length > 0 };
  } catch (error) {
    return { cookies: [], success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}
