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

*Morena is a stateful command-line REPL tool designed for authorized web asset auditing, DOM reconstruction, route discovery, secret scanning, and security reporting.*

</div>

---

## ⚡ Features Overview

| Feature | Description |
| :--- | :--- |
| **🔒 Persistent Session Locking** | Lock onto a target host (`morena > target <url>`) and maintain active session timers. |
| **🔑 Dual Authentication Modes** | Automated form credential login (`login`) & manual browser login (`interactive`) with automatic session cookie capture. |
| **🔎 Route & Link Discovery** | Discover all same-origin internal routes on any web application (`find`). |
| **🔍 Tech Stack Fingerprinting** | Identify frameworks (React, Next, Vue), UI libraries, CDNs, and web servers (`tech-stack`). |
| **🛡️ OWASP Header Auditor** | Evaluate target HTTP headers (CSP, HSTS, CORS, Clickjacking flags) (`audit`). |
| **🔑 Secret & Token Scanner** | Scan JS bundles for leaked API keys, tokens, internal IPs & developer comments (`secrets`). |
| **🌐 API Route Extractor** | Extract hidden REST routes, endpoints, and WebSockets from JavaScript assets (`endpoints`). |
| **📄 Security Report Generator** | Export structured HTML security audit reports directly to `~/Downloads` (`report`). |
| **🌳 Hierarchical ASCII Tree** | Visualize captured DOM & asset structures in tree format (`show`). |
| **📦 Automatic ZIP Archiving** | Reconstructs offline-compatible HTML/CSS/JS/images directly to `~/Downloads` (`take`, `take -all`). |

---

## 🏗️ Architecture Workflow

```mermaid
flowchart TD
    A[Launch Animated Morena REPL] --> B[Lock Target URL\n'target <url>']
    B --> C{Detect Login / Auth Options}
    C -- Login Detected --> D[Choose Auth Mode]
    D --> E[Automated Form Login\n'login']
    D --> F[Manual Chrome Browser\n'interactive']
    E --> G[Capture Session Cookies]
    F --> G
    C -- Public Page --> H[Scrape Runtime DOM & Assets]
    G --> H
    H --> I[Discover Internal Routes\n'find']
    I --> J[Run Security Scanners]
    J --> K1[Fingerprint Tech\n'tech-stack']
    J --> K2[Audit Security Headers\n'audit']
    J --> K3[Scan Leaked Secrets\n'secrets']
    J --> K4[Extract API Endpoints\n'endpoints']
    J --> L[Generate Audit Report\n'report']
    J --> M[Package Assets\n'take -all']
```

---

## 💻 Step-by-Step Installation Guide

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
| `login` | `login` | Automated form login (prompts for username & password) |
| `interactive` | `interactive` | Opens visible Chrome window for manual browser login |
| `find` | `find` | Discovers all internal routes (`/dashboard`, `/profile`, etc.) |
| `crawl` | `crawl dashboard` | Scrapes a specific discovered route |
| `take` | `take` | Scrapes target DOM + assets; triggers page selector |
| `take -all` | `take -all` | Scrapes current page AND all discovered routes into one ZIP |
| `tech-stack` | `tech-stack` | Fingerprints frameworks (React, Next), UI libs, CDNs, & servers |
| `secrets` | `secrets` | Scans JS assets for leaked API keys, tokens & developer comments |
| `endpoints` | `endpoints` | Extracts hidden REST API routes & WebSockets from JS bundles |
| `audit` | `audit` | Audits response headers against OWASP guidelines (CSP, CORS) |
| `report` | `report` | Generates formatted HTML security audit report in `~/Downloads` |
| `show` | `show` | Renders a hierarchical ASCII file tree of scraped assets |
| `scession -time`| `scession -time` | Displays elapsed session duration since target lock |
| `info` | `info` | Displays formatted session status card |
| `headers` | `headers` | Fetches target HTTP response headers |
| `status` | `status` | Pings target URL and reports HTTP status and latency |
| `clean` | `clean` | Deletes temporary staging files and caches |
| `history` | `history` | Displays list of commands executed in session |
| `exit-now` | `exit-now` | Cleans staging directories and exits Morena cleanly |

---

## 📖 Security Audit Execution Example

```text
morena > target palindrome.antoniusjairus.in
[+] Target identified and locked: https://palindrome.antoniusjairus.in/

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
Secret & Sensitive Pattern Scanner Results (2 findings):
  1. [Developer TODO/FIXME Comment] app.js (line 42)
     // TODO: Fix authentication fallback token before deployment
  2. [Internal IP Address] config.js (line 108)
     172.16.0.2

morena > endpoints
Extracted API Routes & Connections for https://palindrome.antoniusjairus.in/:
  REST / API Routes (4):
    • /api/v1/auth/login
    • /api/v1/user/profile
    • /api/v1/transactions
    • /api/v1/analytics

morena > report
✔ Security audit report generated!
Location: /home/jairus/Downloads/morena-report-2026-08-05.html
Summary:  2 Header Failures; 2 Secret Findings
```

---

## 🛡️ Legal & Security Notice

> [!WARNING]
> **AUTHORIZATION REQUIRED:** This tool is strictly designed for authorized security reconnaissance, frontend asset auditing, and web archiving. Ensure you have explicit written permission from target owners before performing assessments.