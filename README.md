<div align="center">

```text
   ███╗   ███╗ ██████╗ ██████╗ ███████╗███╗   ██╗ █████╗ 
   ████╗ ████║██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗
   ██╔████╔██║██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████║
   ██║╚██╔╝██║██║   ██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══██║
   ██║ ╚═╝ ██║╚██████╔╝██║  ██║███████╗██║ ╚████║██║  ██║
   ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝
```

# MORENA REPL

**Automated Client-Side Web Archiving, Security Reconnaissance & Asset Auditing Tool**

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Platform Support](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-blue.svg?style=for-the-badge&logo=linux)](https://github.com/antoniusjairus4/Morena)
[![License](https://img.shields.io/badge/license-ISC-orange.svg?style=for-the-badge)](LICENSE)
[![Puppeteer Automation](https://img.shields.io/badge/engine-Puppeteer%20v22-red.svg?style=for-the-badge&logo=googlechrome)](https://pptr.dev)

*Morena is a stateful command-line REPL tool designed for authorized web asset auditing, DOM reconstruction, secret scanning, and security reporting.*

</div>

---

## ⚡ Features Overview

| Feature | Description |
| :--- | :--- |
| **🔒 Persistent Session Locking** | Lock onto a target host (`morena > target <url>`) and maintain active session state. |
| **⚡ Single-Page Asset Capture** | Instant, zero-friction scraping of target DOM and linked CSS, JS, image, and icon dependencies (`take`). |
| **🔍 Tech Stack Fingerprinting** | Identify frameworks (React, Next, Vue), UI libraries, CDNs, and web servers (`tech-stack`). |
| **🛡️ OWASP Header Auditor** | Evaluate target HTTP headers (CSP, HSTS, CORS, Clickjacking flags) (`audit`). |
| **🔑 Secret & Token Scanner** | Scan JS bundles for leaked API keys, tokens, internal IPs & developer comments (`secrets`). |
| **🌐 API Route Extractor** | Extract hidden REST routes, endpoints, and WebSockets from JavaScript assets (`endpoints`). |
| **📄 Security Report Generator** | Export structured HTML security audit reports directly to `~/Downloads` (`report`). |
| **🌳 Hierarchical ASCII Tree** | Visualize captured DOM & asset structures in a clean file tree format (`show`). |
| **📦 Automatic ZIP Archiving** | Reconstructs offline-compatible HTML/CSS/JS/images directly into a ZIP archive (`take`). |

---

## 🏗️ Architecture Workflow

```mermaid
flowchart TD
    A[Launch Animated Morena REPL] --> B[Lock Target URL\n'target <url>']
    B --> C[Scrape Target DOM & Frontend Assets\n'take']
    C --> D[Run Security Scanners]
    D --> E1[Fingerprint Tech\n'tech-stack']
    D --> E2[Audit Security Headers\n'audit']
    D --> E3[Scan Leaked Secrets\n'secrets']
    D --> E4[Extract API Endpoints\n'endpoints']
    D --> F[Generate Audit Report\n'report']
    D --> G[Package Offline ZIP\n~/Downloads]
```

---

## 💻 Step-by-Step Installation Guide for all OS

### 🐧 1. Linux (Kali Linux, Ubuntu, Debian, Arch)

```bash
# Step 1: Open your Linux terminal & update packages
sudo apt update && sudo apt install -y git nodejs npm

# Step 2: Clone the Morena repository
git clone https://github.com/antoniusjairus4/Morena.git
cd Morena

# Step 3: Install project dependencies
PUPPETEER_SKIP_DOWNLOAD=true npm install

# Step 4: Link globally for system-wide access
sudo npm link

# Step 5: Launch Morena from anywhere!
morena
```

---

### 🍎 2. macOS (Apple Silicon M1/M2/M3 & Intel)

```bash
# Step 1: Open Terminal and ensure Node.js & Git are installed (via Homebrew)
brew install node git

# Step 2: Clone the repository
git clone https://github.com/antoniusjairus4/Morena.git
cd Morena

# Step 3: Install project dependencies
npm install

# Step 4: Link executable globally
sudo npm link

# Step 5: Start Morena REPL
morena
```

---

### 🪟 3. Windows (PowerShell, Command Prompt, or WSL)

```powershell
# Clone the repository
git clone https://github.com/antoniusjairus4/Morena.git
cd Morena

# Install project dependencies
npm install

# Link globally (Run PowerShell as Admin)
npm link

# Launch Morena
morena
```

---

## 🚀 Interactive REPL Command Reference

| Command | Usage Example | Description |
| :--- | :--- | :--- |
| `target` | `target palindrome.antoniusjairus.in` | Lock target host and start session timer |
| `take` | `take` | Scrapes target DOM + asset dependencies and exports ZIP archive |
| `show` | `show` | Renders a hierarchical ASCII file tree of scraped assets |
| `tech-stack` | `tech-stack` | Fingerprints frameworks (React, Next), UI libs, CDNs, & servers |
| `secrets` | `secrets` | Scans JS assets for leaked API keys, tokens & developer comments |
| `endpoints` | `endpoints` | Extracts hidden REST API routes & WebSockets from JS bundles |
| `audit` | `audit` | Audits response headers against OWASP guidelines (CSP, CORS) |
| `report` | `report` | Generates formatted HTML security audit report in `~/Downloads` |
| `headers` | `headers` | Fetches target HTTP response headers |
| `status` | `status` | Pings target URL and reports HTTP status and latency |
| `info` | `info` | Displays formatted session status card |
| `scession -time`| `scession -time` | Displays elapsed session duration since target lock |
| `set-timeout` | `set-timeout 30` | Dynamically set Puppeteer page load timeout limit |
| `clean` | `clean` | Deletes temporary staging files and caches |
| `history` | `history` | Displays list of commands executed in session |
| `exit-now` | `exit-now` | Cleans staging directories and exits Morena cleanly |

---

## 📖 Security Audit Execution Example

```text
morena > target palindrome.antoniusjairus.in
[+] Target identified and locked: https://palindrome.antoniusjairus.in/

morena > take
✔ Scraped final runtime DOM from https://palindrome.antoniusjairus.in/
✔ Downloaded 6 frontend asset dependencies
Save archive to (Enter for /home/jairus/Downloads/morena-dump-2026-08-10.zip):
✔ Packaging complete! Archive successfully generated.

morena > tech-stack
Technology Stack Fingerprints for https://palindrome.antoniusjairus.in/:
  Frameworks:       React.js, Next.js
  UI Libraries:     Tailwind CSS
  Server Headers:   Server: Vercel

morena > audit
OWASP Security Headers Audit for https://palindrome.antoniusjairus.in/:
 [FAIL] Content-Security-Policy: Missing
         ➜ Implement CSP to mitigate XSS and data injection attacks.
 [PASS] Strict-Transport-Security: max-age=31536000; includeSubDomains
         ➜ HSTS is enabled.
 [WARN] X-Frame-Options: Missing
         ➜ Set X-Frame-Options to DENY or SAMEORIGIN to prevent Clickjacking.

morena > secrets
Secret & Sensitive Pattern Scanner Results:
  1. [Internal IP Address] config.js (line 108)
     172.16.0.2

morena > endpoints
Extracted API Routes & Connections for https://palindrome.antoniusjairus.in/:
  REST / API Routes:
    • /api/v1/auth/login
    • /api/v1/user/profile

morena > report
✔ Security audit report generated!
Location: /home/jairus/Downloads/morena-report-2026-08-10.html
Summary:  2 Header Failures; 1 Secret Findings
```

---

## 🛡️ Legal & Security Notice

> [!WARNING]
> **AUTHORIZATION REQUIRED:** This tool is strictly designed for authorized security reconnaissance, frontend asset auditing, and web archiving. Ensure you have explicit written permission from target owners before performing assessments.
