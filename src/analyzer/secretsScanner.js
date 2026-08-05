import fs from 'fs/promises';
import path from 'path';

const SECRET_PATTERNS = [
  { name: 'Google API Key', regex: /AIzaSy[A-Za-z0-9_-]{35}/g },
  { name: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
  { name: 'Stripe Publishable Key', regex: /pk_(live|test)_[0-9a-zA-Z]{24,99}/g },
  { name: 'Firebase URL', regex: /[a-z0-9.-]+\.firebaseio\.com/g },
  { name: 'JWT Token', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'Bearer Token Header', regex: /Bearer\s+[A-Za-z0-9._~+/-]+=*/g },
  { name: 'Private Key Header', regex: /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/g },
  { name: 'Slack Webhook', regex: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]{8}\/B[a-zA-Z0-9_]{8}\/[a-zA-Z0-9_]{24}/g },
  { name: 'Internal IP Address', regex: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g },
  { name: 'Developer TODO/FIXME Comment', regex: /(?:\/\/|\/\*|<!--)\s*(TODO|FIXME|HACK|BUG|SEC|SECURITY):?\s*.*?(?:\*\/|-->|\n)/gi }
];

/**
 * Recursively scans directory for text files.
 */
async function getFiles(dir) {
  const subdirs = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    subdirs.map(async (subdir) => {
      const res = path.resolve(dir, subdir.name);
      return subdir.isDirectory() ? getFiles(res) : res;
    })
  );
  return files.flat();
}

/**
 * Scans content or files in staging directory for exposed secrets and comments.
 * 
 * @param {string} contentOrDir - Raw text content string OR absolute file path / staging directory.
 * @returns {Promise<{ file: string, type: string, match: string, line: number }[]>}
 */
export async function scanForSecrets(contentOrDir) {
  const results = [];

  if (!contentOrDir) return results;

  let targets = [];
  try {
    const stat = await fs.stat(contentOrDir);
    if (stat.isDirectory()) {
      const allFiles = await getFiles(contentOrDir);
      targets = allFiles.filter(f => /\.(js|html|json|css|txt|map)$/i.test(f));
    } else if (stat.isFile()) {
      targets = [contentOrDir];
    }
  } catch {
    // Treat input as raw string content
    targets = [{ isString: true, content: contentOrDir }];
  }

  for (const item of targets) {
    let rawContent = '';
    let filePath = 'Raw Content';

    if (item.isString) {
      rawContent = item.content;
    } else {
      filePath = item;
      try {
        rawContent = await fs.readFile(item, 'utf8');
      } catch {
        continue;
      }
    }

    const lines = rawContent.split('\n');

    for (const pattern of SECRET_PATTERNS) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      while ((match = regex.exec(rawContent)) !== null) {
        // Calculate line number
        const matchIndex = match.index;
        const lineNum = rawContent.substring(0, matchIndex).split('\n').length;
        const matchedText = match[0].trim();

        results.push({
          file: typeof filePath === 'string' ? path.basename(filePath) : 'RAM DOM',
          fullPath: filePath,
          type: pattern.name,
          match: matchedText.length > 80 ? matchedText.substring(0, 77) + '...' : matchedText,
          line: lineNum
        });
      }
    }
  }

  return results;
}
