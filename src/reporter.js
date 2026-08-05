import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Generates an HTML security report document from audit findings.
 */
export async function generateReport({ targetUrl, duration, techStack, audit, secrets, endpoints, scrapedFilesCount }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `morena-report-${timestamp}.html`;
  
  let downloadsFolder = path.join(os.homedir(), 'Downloads');
  try {
    await fs.access(downloadsFolder);
  } catch {
    downloadsFolder = process.cwd();
  }
  const outputPath = path.join(downloadsFolder, filename);

  const failCount = audit.filter(a => a.status === 'FAIL').length;
  const warnCount = audit.filter(a => a.status === 'WARN').length;
  const passCount = audit.filter(a => a.status === 'PASS').length;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morena Security Audit - ${targetUrl}</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --border: #1f2937;
      --accent: #00e5ff;
      --text: #f3f4f6;
      --muted: #9ca3af;
      --pass: #10b981;
      --warn: #f59e0b;
      --fail: #ef4444;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 30px;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    .header { border-bottom: 2px solid var(--accent); padding-bottom: 20px; margin-bottom: 30px; }
    h1 { margin: 0 0 10px 0; color: var(--accent); letter-spacing: 1px; }
    .meta { color: var(--muted); font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 20px; text-align: center; }
    .card-val { font-size: 28px; font-weight: bold; margin-top: 5px; }
    .pass-color { color: var(--pass); }
    .warn-color { color: var(--warn); }
    .fail-color { color: var(--fail); }
    .section { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 25px; margin-bottom: 30px; }
    h2 { margin-top: 0; color: var(--text); font-size: 20px; border-left: 4px solid var(--accent); padding-left: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--border); font-size: 14px; }
    th { color: var(--muted); background: rgba(255,255,255,0.02); }
    .badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
    .badge-PASS { background: rgba(16, 185, 129, 0.2); color: var(--pass); }
    .badge-WARN { background: rgba(245, 158, 11, 0.2); color: var(--warn); }
    .badge-FAIL { background: rgba(239, 68, 68, 0.2); color: var(--fail); }
    ul { margin: 0; padding-left: 20px; }
    li { margin-bottom: 6px; }
    code { font-family: monospace; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; color: var(--accent); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MORENA RECON & SECURITY AUDIT REPORT</h1>
      <div class="meta">Target Host: <strong>${targetUrl}</strong> | Generated: ${new Date().toLocaleString()}</div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="meta">Header Failures</div>
        <div class="card-val fail-color">${failCount}</div>
      </div>
      <div class="card">
        <div class="meta">Header Warnings</div>
        <div class="card-val warn-color">${warnCount}</div>
      </div>
      <div class="card">
        <div class="meta">Header Passes</div>
        <div class="card-val pass-color">${passCount}</div>
      </div>
      <div class="card">
        <div class="meta">Exposed Secrets</div>
        <div class="card-val fail-color">${secrets.length}</div>
      </div>
    </div>

    <div class="section">
      <h2>Technology Stack Fingerprints</h2>
      <ul>
        <li><strong>Frameworks:</strong> ${techStack.frameworks.join(', ') || 'None detected'}</li>
        <li><strong>UI Libraries:</strong> ${techStack.uiLibraries.join(', ') || 'None detected'}</li>
        <li><strong>Analytics / Tracking:</strong> ${techStack.analytics.join(', ') || 'None detected'}</li>
        <li><strong>Server Info:</strong> ${techStack.servers.join(', ') || 'None detected'}</li>
      </ul>
    </div>

    <div class="section">
      <h2>OWASP Security Headers Audit</h2>
      <table>
        <thead>
          <tr>
            <th>Header</th>
            <th>Status</th>
            <th>Value</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          ${audit.map(a => `
            <tr>
              <td><strong>${a.header}</strong></td>
              <td><span class="badge badge-${a.status}">${a.status}</span></td>
              <td><code>${a.value}</code></td>
              <td>${a.recommendation}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Exposed Secrets & Sensitive Findings (${secrets.length})</h2>
      ${secrets.length === 0 ? '<p style="color: var(--pass);">✔ No high-risk secret patterns detected in scraped assets.</p>' : `
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Type</th>
              <th>Match Snippet</th>
              <th>Line</th>
            </tr>
          </thead>
          <tbody>
            ${secrets.map(s => `
              <tr>
                <td><code>${s.file}</code></td>
                <td><strong style="color: var(--fail);">${s.type}</strong></td>
                <td><code>${s.match}</code></td>
                <td>${s.line}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <div class="section">
      <h2>Discovered API Endpoints & WebSockets</h2>
      <p><strong>REST / Route Paths (${endpoints.restRoutes.length}):</strong></p>
      <ul>
        ${endpoints.restRoutes.slice(0, 20).map(r => `<li><code>${r}</code></li>`).join('') || '<li>None detected</li>'}
      </ul>
      <p><strong>WebSockets (${endpoints.sockets.length}):</strong></p>
      <ul>
        ${endpoints.sockets.map(ws => `<li><code>${ws}</code></li>`).join('') || '<li>None detected</li>'}
      </ul>
    </div>
  </div>
</body>
</html>`;

  await fs.writeFile(outputPath, htmlContent, 'utf8');
  return { outputPath, failCount, secretsCount: secrets.length };
}
