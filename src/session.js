import fs from 'fs/promises';
import { cleanupStaging } from './archiver.js';

class SessionManager {
  constructor() {
    this.targetUrl = null;
    this.lockedAt = null;
    this.scrapedData = null;
    this.stagingDir = null;
    this.scrapedFilesList = [];
    this.timeoutSeconds = 30;
    this.commandHistory = [];
    this.cookies = [];
    this.discoveredUrls = [];
  }

  isLocked() {
    return this.targetUrl !== null;
  }

  isAuthenticated() {
    return this.cookies.length > 0;
  }

  lockTarget(urlObj) {
    this.targetUrl = urlObj;
    this.lockedAt = new Date();
    this.scrapedFilesList = [];
    this.discoveredUrls = [];
  }

  setCookies(cookieArray) {
    this.cookies = cookieArray || [];
  }

  setDiscoveredUrls(urls) {
    this.discoveredUrls = urls || [];
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
    this.targetUrl = null;
    this.lockedAt = null;
    this.scrapedData = null;
    this.scrapedFilesList = [];
    this.commandHistory = [];
    this.cookies = [];
    this.discoveredUrls = [];
  }
}

export const session = new SessionManager();
