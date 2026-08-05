import fs from 'fs/promises';
import path from 'path';

const API_REGEX = /(?:"|')(\/(?:api|v[0-9]|graphql|auth|users|admin|v1|v2|v3)\/[a-zA-Z0-9_\-/]+)(?:"|')/gi;
const HTTP_CALL_REGEX = /(?:fetch|axios(?:\.get|\.post|\.put|\.delete)?|\$\.ajax|\$\.get|\$\.post)\s*\(\s*(?:"|')([^"']+)(?:"|')/gi;
const WS_REGEX = /(?:wss?:\/\/[a-zA-Z0-9._~%+/-]+)/gi;

/**
 * Extracts API endpoints and WebSocket URLs from HTML or JS files.
 * 
 * @param {string} contentOrDir - Text string or path to directory.
 * @returns {Promise<{ restRoutes: string[], apiCalls: string[], sockets: string[] }>}
 */
export async function extractEndpoints(contentOrDir) {
  const result = {
    restRoutes: new Set(),
    apiCalls: new Set(),
    sockets: new Set()
  };

  if (!contentOrDir) return { restRoutes: [], apiCalls: [], sockets: [] };

  let rawTexts = [];
  try {
    const stat = await fs.stat(contentOrDir);
    if (stat.isDirectory()) {
      const getFiles = async (dir) => {
        const subdirs = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(
          subdirs.map(async (sd) => {
            const res = path.resolve(dir, sd.name);
            return sd.isDirectory() ? getFiles(res) : res;
          })
        );
        return files.flat();
      };
      const files = (await getFiles(contentOrDir)).filter(f => /\.(js|html|json)$/i.test(f));
      for (const f of files) {
        try {
          rawTexts.push(await fs.readFile(f, 'utf8'));
        } catch {
          // ignore
        }
      }
    } else {
      rawTexts.push(await fs.readFile(contentOrDir, 'utf8'));
    }
  } catch {
    rawTexts.push(String(contentOrDir));
  }

  for (const text of rawTexts) {
    // 1. REST routes
    let m;
    const r1 = new RegExp(API_REGEX.source, API_REGEX.flags);
    while ((m = r1.exec(text)) !== null) {
      if (m[1]) result.restRoutes.add(m[1]);
    }

    // 2. HTTP function calls
    const r2 = new RegExp(HTTP_CALL_REGEX.source, HTTP_CALL_REGEX.flags);
    while ((m = r2.exec(text)) !== null) {
      if (m[1]) result.apiCalls.add(m[1]);
    }

    // 3. WebSockets
    const r3 = new RegExp(WS_REGEX.source, WS_REGEX.flags);
    while ((m = r3.exec(text)) !== null) {
      if (m[0]) result.sockets.add(m[0]);
    }
  }

  return {
    restRoutes: Array.from(result.restRoutes).sort(),
    apiCalls: Array.from(result.apiCalls).sort(),
    sockets: Array.from(result.sockets).sort()
  };
}
