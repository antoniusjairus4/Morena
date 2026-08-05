import fs from 'fs/promises';
import { cleanupStaging } from './archiver.js';

class SessionManager {
  constructor() {
    this.targetUrl = null;
    this.lockedAt = null;
    this.scrapedData = null;
    this.stagingDir = null;
    this.timeoutSeconds = 30;
    this.commandHistory = [];
  }

  isLocked() {
    return this.targetUrl !== null;
  }

  lockTarget(urlObj) {
    this.targetUrl = urlObj;
    this.lockedAt = new Date();
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
      this.scrapedData = null;
    }
  }

  async resetSession() {
    await this.cleanStaging();
    this.targetUrl = null;
    this.lockedAt = null;
    this.scrapedData = null;
    this.commandHistory = [];
  }
}

export const session = new SessionManager();
