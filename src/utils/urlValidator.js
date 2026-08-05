/**
 * Validates and normalizes the target URL string.
 * @param {string} urlString - The URL input string from CLI.
 * @returns {URL} - The parsed URL object.
 */
export function validateUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('Target URL argument is required.');
  }

  let normalized = urlString.trim().replace(/^<+|>+$/g, '');
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  try {
    const parsedUrl = new URL(normalized);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only http: and https: are allowed.`);
    }
    return parsedUrl;
  } catch (err) {
    if (err.code === 'ERR_INVALID_URL' || err instanceof TypeError) {
      throw new Error(`Invalid URL format: "${urlString}". Please provide a valid HTTP/HTTPS URL.`);
    }
    throw err;
  }
}
