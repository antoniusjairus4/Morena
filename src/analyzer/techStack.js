import * as cheerio from 'cheerio';

/**
 * Fingerprints technology stack from HTML content and HTTP headers.
 * 
 * @param {string} html - The DOM HTML content.
 * @param {Headers|object} headers - HTTP response headers object or Headers instance.
 * @returns {object} Discovered tech stack categories.
 */
export function analyzeTechStack(html, headers = {}) {
  const result = {
    frameworks: [],
    uiLibraries: [],
    analytics: [],
    servers: [],
    metaTools: []
  };

  const getHeader = (name) => {
    if (!headers) return '';
    if (typeof headers.get === 'function') return headers.get(name) || '';
    const lowerName = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lowerName) return String(v);
    }
    return '';
  };

  const serverHeader = getHeader('server');
  const poweredBy = getHeader('x-powered-by');
  const viaHeader = getHeader('via');

  if (serverHeader) result.servers.push(serverHeader);
  if (poweredBy) result.servers.push(`X-Powered-By: ${poweredBy}`);
  if (viaHeader) result.servers.push(`Via: ${viaHeader}`);

  if (!html) return result;
  const $ = cheerio.load(html);

  // 1. React
  if ($('[data-reactroot], [data-reactid]').length > 0 || html.includes('react-dom') || html.includes('_reactListening')) {
    result.frameworks.push('React.js');
  }

  // 2. Next.js
  if ($('#__NEXT_DATA__').length > 0 || html.includes('_next/static')) {
    result.frameworks.push('Next.js');
  }

  // 3. Vue.js / Nuxt
  if ($('[data-v-]').length > 0 || html.includes('__NUXT__') || html.includes('vue.js') || html.includes('vue.min.js')) {
    result.frameworks.push(html.includes('__NUXT__') ? 'Nuxt.js (Vue)' : 'Vue.js');
  }

  // 4. Angular
  if ($('[ng-version], [ng-app]').length > 0 || html.includes('ng-binding')) {
    const version = $('[ng-version]').attr('ng-version');
    result.frameworks.push(version ? `Angular v${version}` : 'Angular');
  }

  // 5. Svelte / SvelteKit
  if (html.includes('svelte-') || html.includes('__sveltekit')) {
    result.frameworks.push('Svelte / SvelteKit');
  }

  // 6. Tailwind CSS
  if (html.includes('tailwindcss') || $('[class*="flex "], [class*="grid "], [class*="px-"], [class*="bg-"]').length > 3) {
    result.uiLibraries.push('Tailwind CSS');
  }

  // 7. Bootstrap
  if ($('link[href*="bootstrap"]').length > 0 || $('[class*="col-md-"], [class*="btn-primary"]').length > 0) {
    result.uiLibraries.push('Bootstrap');
  }

  // 8. FontAwesome
  if ($('link[href*="fontawesome"], link[href*="fa-"]').length > 0 || $('[class*="fa-"]').length > 0) {
    result.uiLibraries.push('FontAwesome Icons');
  }

  // 9. jQuery
  if (html.includes('jquery.min.js') || html.includes('jquery.js')) {
    result.uiLibraries.push('jQuery');
  }

  // 10. Analytics & Tracking
  if (html.includes('google-analytics.com') || html.includes('googletagmanager.com')) {
    result.analytics.push('Google Analytics / GTM');
  }
  if (html.includes('connect.facebook.net')) {
    result.analytics.push('Facebook Pixel');
  }
  if (html.includes('mixpanel')) {
    result.analytics.push('Mixpanel Analytics');
  }

  // Meta Generator
  const generator = $('meta[name="generator"]').attr('content');
  if (generator) {
    result.metaTools.push(`Generator: ${generator}`);
  }

  // Deduplicate
  result.frameworks = [...new Set(result.frameworks)];
  result.uiLibraries = [...new Set(result.uiLibraries)];
  result.analytics = [...new Set(result.analytics)];
  result.servers = [...new Set(result.servers)];
  result.metaTools = [...new Set(result.metaTools)];

  return result;
}
