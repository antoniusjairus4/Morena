/**
 * Audits HTTP response headers against OWASP hardening recommendations.
 * 
 * @param {Headers|object} headers 
 * @returns {{ header: string, value: string, status: 'PASS' | 'WARN' | 'FAIL', recommendation: string }[]}
 */
export function auditSecurityHeaders(headers = {}) {
  const getHeader = (name) => {
    if (!headers) return '';
    if (typeof headers.get === 'function') return headers.get(name) || '';
    const lowerName = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lowerName) return String(v);
    }
    return '';
  };

  const auditList = [];

  // 1. Content-Security-Policy (CSP)
  const csp = getHeader('content-security-policy');
  if (!csp) {
    auditList.push({
      header: 'Content-Security-Policy',
      value: 'Missing',
      status: 'FAIL',
      recommendation: 'Implement CSP to mitigate XSS and data injection attacks.'
    });
  } else if (csp.includes("'unsafe-inline'") || csp.includes('*')) {
    auditList.push({
      header: 'Content-Security-Policy',
      value: csp,
      status: 'WARN',
      recommendation: 'Avoid \'unsafe-inline\' or wildcards (*) in script-src directives.'
    });
  } else {
    auditList.push({
      header: 'Content-Security-Policy',
      value: csp.length > 50 ? csp.substring(0, 47) + '...' : csp,
      status: 'PASS',
      recommendation: 'Strict CSP policy detected.'
    });
  }

  // 2. Strict-Transport-Security (HSTS)
  const hsts = getHeader('strict-transport-security');
  if (!hsts) {
    auditList.push({
      header: 'Strict-Transport-Security',
      value: 'Missing',
      status: 'FAIL',
      recommendation: 'Enforce HTTPS via HSTS with max-age=31536000; includeSubDomains.'
    });
  } else {
    auditList.push({
      header: 'Strict-Transport-Security',
      value: hsts,
      status: 'PASS',
      recommendation: 'HSTS is enabled.'
    });
  }

  // 3. X-Frame-Options (Clickjacking)
  const xfo = getHeader('x-frame-options');
  if (!xfo) {
    auditList.push({
      header: 'X-Frame-Options',
      value: 'Missing',
      status: 'WARN',
      recommendation: 'Set X-Frame-Options to DENY or SAMEORIGIN to prevent Clickjacking.'
    });
  } else {
    auditList.push({
      header: 'X-Frame-Options',
      value: xfo,
      status: 'PASS',
      recommendation: 'Frame embedding protection enabled.'
    });
  }

  // 4. X-Content-Type-Options (MIME Sniffing)
  const xcto = getHeader('x-content-type-options');
  if (!xcto || xcto.toLowerCase() !== 'nosniff') {
    auditList.push({
      header: 'X-Content-Type-Options',
      value: xcto || 'Missing',
      status: 'FAIL',
      recommendation: 'Set X-Content-Type-Options: nosniff to prevent MIME sniffing exploits.'
    });
  } else {
    auditList.push({
      header: 'X-Content-Type-Options',
      value: xcto,
      status: 'PASS',
      recommendation: 'MIME sniffing disabled.'
    });
  }

  // 5. Access-Control-Allow-Origin (CORS Wildcard)
  const cors = getHeader('access-control-allow-origin');
  if (cors === '*') {
    auditList.push({
      header: 'Access-Control-Allow-Origin',
      value: '*',
      status: 'FAIL',
      recommendation: 'CORS wildcard detected. Do not allow all origins on sensitive endpoints.'
    });
  } else if (cors) {
    auditList.push({
      header: 'Access-Control-Allow-Origin',
      value: cors,
      status: 'PASS',
      recommendation: 'Specific CORS origin restriction in place.'
    });
  }

  // 6. Referrer-Policy
  const refPol = getHeader('referrer-policy');
  if (!refPol) {
    auditList.push({
      header: 'Referrer-Policy',
      value: 'Missing',
      status: 'WARN',
      recommendation: 'Set Referrer-Policy: strict-origin-when-cross-origin to protect Referer data.'
    });
  } else {
    auditList.push({
      header: 'Referrer-Policy',
      value: refPol,
      status: 'PASS',
      recommendation: 'Referrer policy specified.'
    });
  }

  return auditList;
}
