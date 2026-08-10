import fs from 'fs/promises';
import { cleanupStaging } from './archiver.js';

class SessionManager {
  constructor() {
    if (SessionManager.instance) {
      return SessionManager.instance;
    }
    SessionManager.instance = this;

    this.reset();
  }

  reset() {
    this.targetUrl = null;
    this.lockedAt = null;
    this.scrapedData = null;
    this.stagingDir = null;
    this.scrapedFilesList = [];
    this.timeoutSeconds = 30;
    this.commandHistory = [];
    this.cookies = [];
    this.localStorageData = {};
    this.sessionStorageData = {};
    this.discoveredUrls = [];
  }

  isLocked() {
    return this.targetUrl !== null;
  }

  isAuthenticated() {
    return (this.cookies && this.cookies.length > 0) || (this.localStorageData && Object.keys(this.localStorageData).length > 0);
  }

  lockTarget(urlObj) {
    this.targetUrl = urlObj;
    this.lockedAt = new Date();
    this.scrapedFilesList = [];
    this.discoveredUrls = [];
  }

  setTarget(url) {
    if (typeof url === 'string') {
      try {
        this.targetUrl = new URL(url);
      } catch {
        // keep string
      }
    } else if (url) {
      this.targetUrl = url;
    }
    if (!this.lockedAt) {
      this.lockedAt = new Date();
    }
  }

  setCookies(cookieArray) {
    this.cookies = cookieArray || [];
  }

  setStorage(localStorageObj, sessionStorageObj) {
    this.localStorageData = localStorageObj || {};
    this.sessionStorageData = sessionStorageObj || {};
  }

  setDiscoveredUrls(urls) {
    this.discoveredUrls = urls || [];
  }

  // Capture state directly from an active Puppeteer page instance
  async captureBrowserState(page) {
    try {
      this.cookies = await page.cookies();
      this.localStorageData = await page.evaluate(() => {
        const items = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          items[key] = localStorage.getItem(key);
        }
        return items;
      }).catch(() => ({}));

      this.sessionStorageData = await page.evaluate(() => {
        const items = {};
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          items[key] = sessionStorage.getItem(key);
        }
        return items;
      }).catch(() => ({}));
    } catch (error) {
      console.error('[-] Failed to capture browser state:', error.message);
    }
  }

  // Inject saved state into any new Puppeteer page prior to navigation
  async applyBrowserState(page) {
    try {
      if (this.cookies && this.cookies.length > 0) {
        await page.setCookie(...this.cookies);
      }

      if ((this.localStorageData && Object.keys(this.localStorageData).length > 0) || (this.sessionStorageData && Object.keys(this.sessionStorageData).length > 0)) {
        await page.evaluateOnNewDocument((local, session) => {
          if (local) {
            for (const [k, v] of Object.entries(local)) {
              try { localStorage.setItem(k, v); } catch (e) {}
            }
          }
          if (session) {
            for (const [k, v] of Object.entries(session)) {
              try { sessionStorage.setItem(k, v); } catch (e) {}
            }
          }
        }, this.localStorageData, this.sessionStorageData);
      }
    } catch (error) {
      console.error('[-] Failed to apply browser state:', error.message);
    }
  }

  getDuration() {
    if (!this.lockedAt) return { minutes: 0, seconds: 0, totalSeconds: 0 };
    const diffMs = Date.now() - this.lockedAt.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds, totalSeconds };
  }

  addHistory(cmd) {
    if (cmd && cmd.trim()) {
      this.commandHistory.push(cmd.trim());
    }
  }

  setTimeoutSeconds(seconds) {
    const num = parseInt(seconds, 10);
    if (isNaN(num) || num <= 0) {
      throw new Error('Timeout must be a positive integer in seconds.');
    }
    this.timeoutSeconds = num;
  }

  async cleanStaging() {
    if (this.stagingDir) {
      await cleanupStaging(this.stagingDir);
      this.stagingDir = null;
    }
  }

  async resetSession() {
    await this.cleanStaging();
    this.reset();
  }
}

export const session = new SessionManager();
export { SessionManager };
