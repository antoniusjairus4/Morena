import test from 'node:test';
import assert from 'node:assert/strict';
import { triggerBrightDataCollector } from '../src/analyzer/brightdataCollector.js';

test('triggerBrightDataCollector - validation errors', async (t) => {
  await t.test('throws if token is missing', async () => {
    await assert.rejects(
      () => triggerBrightDataCollector({ token: '', collectorId: 'c_12345', urls: 'https://example.com' }),
      { message: 'Bright Data API token is required.' }
    );
  });

  await t.test('throws if collectorId is missing', async () => {
    await assert.rejects(
      () => triggerBrightDataCollector({ token: 'test-token', collectorId: '', urls: 'https://example.com' }),
      { message: 'Bright Data Collector ID is required.' }
    );
  });

  await t.test('throws if urls is missing', async () => {
    await assert.rejects(
      () => triggerBrightDataCollector({ token: 'test-token', collectorId: 'c_12345', urls: null }),
      { message: 'At least one target URL is required to trigger collector.' }
    );
  });
});

test('triggerBrightDataCollector - payload formatting & mocked API call', async (t) => {
  const originalFetch = global.fetch;

  t.afterEach(() => {
    global.fetch = originalFetch;
  });

  await t.test('formats request headers, params, and body correctly', async () => {
    let capturedUrl = '';
    let capturedOptions = {};

    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ response_id: 'res_abc123', status: 'queued' })
      };
    };

    const res = await triggerBrightDataCollector({
      token: 'MY_SECRET_TOKEN',
      collectorId: 'c_xyz789',
      urls: 'https://target-site.com',
      queueNext: 1
    });

    assert.equal(res.success, true);
    assert.equal(res.statusCode, 200);
    assert.equal(res.responseData.response_id, 'res_abc123');

    assert.equal(capturedUrl, 'https://api.brightdata.com/dca/trigger?collector=c_xyz789&queue_next=1');
    assert.equal(capturedOptions.headers['Authorization'], 'Bearer MY_SECRET_TOKEN');
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(capturedOptions.body), [{ url: 'https://target-site.com' }]);
  });

  await t.test('handles array of string URLs correctly', async () => {
    let capturedBody = '';

    global.fetch = async (url, options) => {
      capturedBody = options.body;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true })
      };
    };

    await triggerBrightDataCollector({
      token: 'MY_TOKEN',
      collectorId: 'c_123',
      urls: ['https://site1.com', 'https://site2.com']
    });

    assert.deepEqual(JSON.parse(capturedBody), [
      { url: 'https://site1.com' },
      { url: 'https://site2.com' }
    ]);
  });
});
