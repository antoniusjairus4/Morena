/**
 * Bright Data Data Collector API Integrator Module
 * 
 * Triggers Bright Data Data Collector (DCA) web scraping jobs via API endpoint:
 * POST https://api.brightdata.com/dca/trigger?collector=<COLLECTOR_ID>&queue_next=1
 */

/**
 * Triggers a Bright Data collector job for one or more target URLs.
 * 
 * @param {Object} options
 * @param {string} options.token - Bright Data API Bearer Token
 * @param {string} options.collectorId - Bright Data Collector ID (e.g., 'c_xxxxxx')
 * @param {string|string[]|Array<{url: string}>} options.urls - Single URL string, array of URL strings, or array of objects with url key
 * @param {number|boolean} [options.queueNext=1] - Priority queue flag (1 for queue next, 0 otherwise)
 * @returns {Promise<{ success: boolean, statusCode: number, responseData: any, error?: string }>}
 */
export async function triggerBrightDataCollector({ token, collectorId, urls, queueNext = 1 }) {
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new Error('Bright Data API token is required.');
  }

  if (!collectorId || typeof collectorId !== 'string' || !collectorId.trim()) {
    throw new Error('Bright Data Collector ID is required.');
  }

  if (!urls) {
    throw new Error('At least one target URL is required to trigger collector.');
  }

  // Normalize URLs payload array format: [{ url: "..." }]
  let payload = [];
  if (typeof urls === 'string') {
    payload = [{ url: urls.trim() }];
  } else if (Array.isArray(urls)) {
    payload = urls.map(item => {
      if (typeof item === 'string') {
        return { url: item.trim() };
      } else if (item && typeof item === 'object' && item.url) {
        return { url: String(item.url).trim() };
      }
      return item;
    });
  } else if (typeof urls === 'object' && urls.url) {
    payload = [{ url: String(urls.url).trim() }];
  }

  if (payload.length === 0) {
    throw new Error('Target payload array cannot be empty.');
  }

  const cleanCollectorId = collectorId.trim();
  const queueParam = queueNext ? '1' : '0';
  const endpoint = `https://api.brightdata.com/dca/trigger?collector=${encodeURIComponent(cleanCollectorId)}&queue_next=${queueParam}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await res.text();
    let responseData = null;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (!res.ok) {
      const errMsg = typeof responseData === 'object' && responseData && (responseData.error || responseData.message)
        ? (responseData.error || responseData.message)
        : `HTTP ${res.status}: ${res.statusText}`;
      
      return {
        success: false,
        statusCode: res.status,
        responseData,
        error: errMsg
      };
    }

    return {
      success: true,
      statusCode: res.status,
      responseData
    };
  } catch (err) {
    return {
      success: false,
      statusCode: 0,
      responseData: null,
      error: err.message
    };
  }
}
