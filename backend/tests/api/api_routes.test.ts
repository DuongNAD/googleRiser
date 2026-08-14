/**
 * SME AutoPilot — Backend Express REST & SSE API Integration Test Suite
 * backend/tests/api/api_routes.test.ts
 */

import http from 'http';
import { app } from '../../src/server';
import { getGoogleFactory } from '../../src/google/factory';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

interface HttpRequestOptions {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: any;
  rawBody?: string;
}

interface HttpResponseData {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: any;
  rawText: string;
}

class TestHttpClient {
  private server: http.Server | null = null;
  private port: number = 0;

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = app.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as any;
        this.port = addr.port;
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  public request(options: HttpRequestOptions): Promise<HttpResponseData> {
    return new Promise((resolve, reject) => {
      const payload = options.rawBody !== undefined
        ? options.rawBody
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined;

      const headers: Record<string, string> = {
        ...(options.headers || {})
      };

      if (payload !== undefined && !headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
      if (payload !== undefined && !headers['Content-Length'] && !headers['content-length']) {
        headers['Content-Length'] = Buffer.byteLength(payload).toString();
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this.port,
          path: options.path,
          method: options.method,
          headers
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            let parsedBody: any = data;
            try {
              parsedBody = JSON.parse(data);
            } catch {
              // keep as raw text
            }
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers,
              body: parsedBody,
              rawText: data
            });
          });
        }
      );

      req.on('error', (err) => reject(err));

      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  }

  public stream(
    path: string,
    onChunk: (chunk: string) => void,
    timeoutMs: number = 2000
  ): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; fullText: string }> {
    return new Promise((resolve, reject) => {
      let fullText = '';
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this.port,
          path,
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream'
          }
        },
        (res) => {
          res.on('data', (chunk) => {
            const str = chunk.toString();
            fullText += str;
            onChunk(str);
            if (fullText.includes('event: done')) {
              req.destroy();
              resolve({
                statusCode: res.statusCode || 0,
                headers: res.headers,
                fullText
              });
            }
          });

          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers,
              fullText
            });
          });
        }
      );

      req.on('error', (err) => {
        // If aborted intentionally, resolve
        if ((err as any).code === 'ECONNRESET' || fullText.length > 0) {
          resolve({
            statusCode: 200,
            headers: {},
            fullText
          });
        } else {
          reject(err);
        }
      });

      req.setTimeout(timeoutMs, () => {
        req.destroy();
        resolve({
          statusCode: 200,
          headers: {},
          fullText
        });
      });

      req.end();
    });
  }
}

export async function runApiRoutesTests(): Promise<TestResult[]> {
  const client = new TestHttpClient();
  await client.start();
  const results: TestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    const start = Date.now();
    try {
      await fn();
      results.push({
        name,
        passed: true,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        name,
        passed: false,
        error: err.message || String(err),
        durationMs: Date.now() - start
      });
    }
  };

  try {
    // Reset mocks before tests
    getGoogleFactory().seedAllMocks('fashion');

    // ========================================================================
    // 1. HEALTH & READINESS PROBES
    // ========================================================================
    await runTest('Health: GET /healthz returns 200 OK liveness', async () => {
      const res = await client.request({ method: 'GET', path: '/healthz' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (res.body.status !== 'ok') throw new Error(`Expected status 'ok', got ${res.body.status}`);
      if (typeof res.body.uptime !== 'number') throw new Error('Expected numeric uptime');
    });

    await runTest('Health: GET /api/health returns 200 OK with services status and system metrics', async () => {
      const res = await client.request({ method: 'GET', path: '/api/health' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!res.body.success && res.body.status !== 'ok') throw new Error('Expected successful health status');
      const healthData = res.body.data || res.body;
      if (!healthData.services || typeof healthData.services.sheets !== 'boolean') {
        throw new Error('Expected boolean service statuses in health response');
      }
      if (!healthData.system || typeof healthData.system.uptime !== 'number') {
        throw new Error('Expected system metrics in health response');
      }
    });

    // ========================================================================
    // 2. MULTIMODAL AI ROUTES
    // ========================================================================
    await runTest('AI Forensics: POST /api/ai/forensics/audit-bill analyzes authentic receipt', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/forensics/audit-bill',
        body: {
          receiptData: {
            bankName: 'VCB',
            amount: 589000,
            accountNumber: '0123456789',
            transactionTime: '2026-08-14 14:32:10'
          },
          expectedAmount: 589000
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!res.body.success) throw new Error('Expected success = true');
      if (res.body.data.isAuthentic !== true) throw new Error('Expected isAuthentic = true');
      if (res.body.data.confidenceScore < 0.8) throw new Error('Expected high confidence score');
    });

    await runTest('AI Product Studio: POST /api/ai/product/generate-marketing generates copy & Imagen 3 themes', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/product/generate-marketing',
        body: {
          productName: 'Áo Dài Lụa Hà Đông Thêu Tay',
          rawDescription: 'Chất liệu lụa tơ tằm nguyên chất 100%, họa tiết hoa sen thêu thủ công tinh xảo',
          stagingTheme: 'TRADITIONAL_TET',
          tone: 'LUXURY_ELEGANT'
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!res.body.success) throw new Error('Expected success = true');
      const pack = res.body.data;
      if (!pack.studioPrompts?.prompts?.TRADITIONAL_TET) {
        throw new Error('Missing TRADITIONAL_TET staging prompt');
      }
      if (!pack.channelCopies?.facebook || !pack.channelCopies?.tiktokShop) {
        throw new Error('Missing multi-channel copy for Facebook or TikTok');
      }
    });

    await runTest('AI Voice Assistant: POST /api/ai/voice/chat handles multi-dialect turn with function calls', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/voice/chat',
        body: {
          sessionId: 'test_session_central_001',
          message: 'Shop ơi cái áo ni giá răng rứa hè?'
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!res.body.success) throw new Error('Expected success = true');
      if (res.body.data.detectedDialect !== 'CENTRAL') {
        throw new Error(`Expected CENTRAL dialect, got ${res.body.data.detectedDialect}`);
      }
      if (!res.body.data.responseText) throw new Error('Expected non-empty response text');
    });

    await runTest('AI Voice Assistant: POST /api/ai/voice/audio-order processes audio buffer', async () => {
      const fakeAudioBase64 = Buffer.from('RIFF_MOCK_AUDIO_DATA_FOR_TEST').toString('base64');
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/voice/audio-order',
        body: {
          sessionId: 'test_audio_session_001',
          audioBase64: fakeAudioBase64,
          mimeType: 'audio/webm'
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!res.body.success) throw new Error('Expected success = true');
    });

    await runTest('AI Voice Assistant: POST /api/ai/voice/audio-order returns 400 when audio payload is missing', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/voice/audio-order',
        body: {
          sessionId: 'test_missing_audio'
        }
      });
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
      if (res.body.error?.code !== 'MISSING_AUDIO_PAYLOAD') {
        throw new Error(`Expected MISSING_AUDIO_PAYLOAD, got ${res.body.error?.code}`);
      }
    });

    await runTest('AI SSE Streaming: GET /api/ai/stream-generate streams tokens and completes with done event', async () => {
      let chunksReceived = 0;
      let hasDoneEvent = false;

      const streamRes = await client.stream(
        '/api/ai/stream-generate?prompt=Xin+chao+SME+AutoPilot',
        (chunk) => {
          chunksReceived++;
          if (chunk.includes('event: done')) {
            hasDoneEvent = true;
          }
        }
      );

      if (streamRes.statusCode !== 200) throw new Error(`Expected 200, got ${streamRes.statusCode}`);
      if (chunksReceived === 0) throw new Error('Expected at least 1 stream chunk');
      if (!hasDoneEvent && !streamRes.fullText.includes('event: done')) {
        throw new Error('Expected event: done in stream output');
      }
    });

    // ========================================================================
    // 3. GOOGLE ECOSYSTEM & SPI ROUTES
    // ========================================================================
    await runTest('Google Sheets: GET /api/google/sheets/inventory returns inventory catalog', async () => {
      const res = await client.request({ method: 'GET', path: '/api/google/sheets/inventory' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!Array.isArray(res.body.data) || res.body.data.length === 0) {
        throw new Error('Expected non-empty inventory array');
      }
    });

    await runTest('Google Sheets: POST /api/google/sheets/inventory/adjust updates stock quantity', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/sheets/inventory/adjust',
        body: { sku: 'FAS-AD-HD-RED-S', delta: -2 }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (res.body.data.sku !== 'FAS-AD-HD-RED-S') throw new Error('Expected SKU match');
    });

    await runTest('Google Sheets: GET /api/google/sheets/orders returns orders journal', async () => {
      const res = await client.request({ method: 'GET', path: '/api/google/sheets/orders' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!Array.isArray(res.body.data)) throw new Error('Expected orders array');
    });

    await runTest('Google Sheets: POST /api/google/sheets/sync triggers bi-directional synchronization', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/sheets/sync',
        body: { type: 'all' }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (typeof res.body.data.inventoryCount !== 'number') {
        throw new Error('Expected inventoryCount in sync response');
      }
    });

    await runTest('Gmail: POST /api/google/gmail/invoice dispatches invoice email', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/gmail/invoice',
        body: {
          recipientEmail: 'khachhang@example.com',
          orderId: 'ORD-TEST-999',
          totalAmount: 450000
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (res.body.data.status !== 'SENT') throw new Error('Expected status SENT');
    });

    await runTest('Gmail: GET /api/google/gmail/outbox retrieves sent email records', async () => {
      const res = await client.request({ method: 'GET', path: '/api/google/gmail/outbox' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!Array.isArray(res.body.data)) throw new Error('Expected outbox array');
    });

    await runTest('Calendar: POST /api/google/calendar/events creates sales reminder event', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/calendar/events',
        body: {
          title: 'Livestream TikTok Flash Sale 8.8',
          startTime: '2026-08-14T20:00:00+07:00',
          endTime: '2026-08-14T22:00:00+07:00',
          eventType: 'LIVESTREAM_SALES'
        }
      });
      if (res.statusCode !== 201) throw new Error(`Expected 201 Created, got ${res.statusCode}`);
      if (!res.body.data.eventId) throw new Error('Expected created eventId');
    });

    await runTest('Calendar: GET /api/google/calendar/events lists scheduled events', async () => {
      const res = await client.request({ method: 'GET', path: '/api/google/calendar/events' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!Array.isArray(res.body.data)) throw new Error('Expected events array');
    });

    await runTest('Google Maps: POST /api/google/maps/distance calculates distance & shipping tier', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/maps/distance',
        body: {
          origin: 'Hồ Hoàn Kiếm, Hà Nội',
          destination: 'Cầu Giấy, Hà Nội'
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (typeof res.body.data.distanceKm !== 'number') throw new Error('Expected numeric distanceKm');
      if (typeof res.body.data.shippingRateVnd !== 'number') throw new Error('Expected numeric shippingRateVnd');
    });

    await runTest('Google Maps: POST /api/google/maps/optimize-route computes 2-Opt TSP route', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/maps/optimize-route',
        body: {
          depot: 'Kho Tổng Hà Nội',
          stops: [
            { orderId: 'ORD-01', address: 'Quận Ba Đình, Hà Nội' },
            { orderId: 'ORD-02', address: 'Quận Đống Đa, Hà Nội' },
            { orderId: 'ORD-03', address: 'Quận Cầu Giấy, Hà Nội' }
          ]
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!Array.isArray(res.body.data.optimizedStops)) throw new Error('Expected optimizedStops array');
    });

    await runTest('Google Maps: GET /api/google/maps/branches returns merchant store branches', async () => {
      const res = await client.request({ method: 'GET', path: '/api/google/maps/branches' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!Array.isArray(res.body.data) || res.body.data.length === 0) throw new Error('Expected store branches array');
    });

    await runTest('Firestore: GET /api/google/firestore/audit-logs queries audit log history', async () => {
      const res = await client.request({ method: 'GET', path: '/api/google/firestore/audit-logs' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!Array.isArray(res.body.data)) throw new Error('Expected audit logs array');
    });

    // ========================================================================
    // 4. INDUSTRY SEED & CONVENIENCE REST ROUTES
    // ========================================================================
    await runTest('Seed Engine: POST /api/google/seed/switch-industry switches to FnB industry', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/seed/switch-industry',
        body: { industryId: 'fnb' }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (res.body.data.industryId !== 'fnb') throw new Error('Expected switched industryId = fnb');
    });

    await runTest('Orders Convenience: GET /api/orders forwards to Google Sheets orders', async () => {
      const res = await client.request({ method: 'GET', path: '/api/orders' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!Array.isArray(res.body.data)) throw new Error('Expected orders array');
    });

    await runTest('Inventory Convenience: GET /api/inventory forwards to Google Sheets inventory', async () => {
      const res = await client.request({ method: 'GET', path: '/api/inventory' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!Array.isArray(res.body.data)) throw new Error('Expected inventory array');
    });

    // ========================================================================
    // 5. ERROR HANDLING & MIDDLEWARE BOUNDARY TESTS
    // ========================================================================
    await runTest('Errors: 404 Route Not Found returns structured ApiResponse', async () => {
      const res = await client.request({ method: 'GET', path: '/api/non_existent_endpoint_xyz' });
      if (res.statusCode !== 404) throw new Error(`Expected 404, got ${res.statusCode}`);
      if (res.body.success !== false) throw new Error('Expected success = false');
      if (res.body.error?.code !== 'ROUTE_NOT_FOUND') {
        throw new Error(`Expected code ROUTE_NOT_FOUND, got ${res.body.error?.code}`);
      }
    });

    await runTest('Errors: Malformed JSON body returns 400 Bad Request with INVALID_JSON', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/forensics/audit-bill',
        rawBody: '{"receiptData": { "broken": unclosed string...',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
      if (res.body.error?.code !== 'INVALID_JSON') {
        throw new Error(`Expected INVALID_JSON, got ${res.body.error?.code}`);
      }
    });

    // ========================================================================
    // 6. ADVANCED LIFECYCLE, MODE SWITCHING & ALIAS ROUTES
    // ========================================================================
    await runTest('Mode Switch: POST /api/google/mode/switch toggles between DEMO and LIVE', async () => {
      const liveRes = await client.request({
        method: 'POST',
        path: '/api/google/mode/switch',
        body: { mode: 'live' }
      });
      if (liveRes.statusCode !== 200) throw new Error(`Expected 200, got ${liveRes.statusCode}`);
      if (liveRes.body.data.mode !== 'LIVE') throw new Error('Expected mode LIVE');

      const demoRes = await client.request({
        method: 'POST',
        path: '/api/google/mode/switch',
        body: { mode: 'demo' }
      });
      if (demoRes.statusCode !== 200) throw new Error(`Expected 200, got ${demoRes.statusCode}`);
      if (demoRes.body.data.mode !== 'DEMO') throw new Error('Expected mode DEMO');
    });

    await runTest('Orders Lifecycle: POST /api/orders -> GET /:id -> PATCH /:id/status -> Filter', async () => {
      // 1. Create order
      const newOrder = {
        orderId: `ORD-LIVE-${Date.now()}`,
        customerName: 'Trần Thị Thảo',
        customerPhone: '0912345678',
        deliveryAddress: '15 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
        city: 'Ho Chi Minh City',
        items: [
          { sku: 'FAS-AD-HD-RED-S', name: 'Áo Dài Lụa Hà Đông', quantity: 2, unitPrice: 650000, subtotal: 1300000 }
        ],
        itemsSubtotal: 1300000,
        shippingFee: 30000,
        discountAmount: 50000,
        totalAmount: 1280000,
        paymentMethod: 'VIETQR_NAPAS',
        paymentStatus: 'PAID' as const,
        orderStatus: 'CONFIRMED' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const createRes = await client.request({
        method: 'POST',
        path: '/api/orders',
        body: newOrder
      });
      if (createRes.statusCode !== 201) throw new Error(`Expected 201 Created, got ${createRes.statusCode}`);

      // 2. Fetch by ID
      const getRes = await client.request({
        method: 'GET',
        path: `/api/orders/${newOrder.orderId}`
      });
      if (getRes.statusCode !== 200) throw new Error(`Expected 200, got ${getRes.statusCode}`);
      if (getRes.body.data.customerName !== 'Trần Thị Thảo') throw new Error('Customer name mismatch');

      // 3. Update status to SHIPPED
      const patchRes = await client.request({
        method: 'PATCH',
        path: `/api/orders/${newOrder.orderId}/status`,
        body: { orderStatus: 'SHIPPED' }
      });
      if (patchRes.statusCode !== 200) throw new Error(`Expected 200, got ${patchRes.statusCode}`);
      if (patchRes.body.data.orderStatus !== 'SHIPPED') throw new Error('Status not updated to SHIPPED');

      // 4. Query with filter
      const filterRes = await client.request({
        method: 'GET',
        path: '/api/orders?orderStatus=SHIPPED'
      });
      if (filterRes.statusCode !== 200) throw new Error(`Expected 200, got ${filterRes.statusCode}`);
      const filtered = filterRes.body.data;
      if (!Array.isArray(filtered) || !filtered.some(o => o.orderId === newOrder.orderId)) {
        throw new Error('Expected created order in SHIPPED list');
      }
    });

    await runTest('AI Forensics Aliases: POST /api/ai/forensics/analyze and /api/v1/ai/audit work seamlessly', async () => {
      const res1 = await client.request({
        method: 'POST',
        path: '/api/ai/forensics/analyze',
        body: { receiptData: { bankName: 'MB', amount: 250000 } }
      });
      if (res1.statusCode !== 200 || !res1.body.success) throw new Error('Analyze alias failed');

      const res2 = await client.request({
        method: 'POST',
        path: '/api/v1/ai/audit',
        body: { receiptData: { bankName: 'TCB', amount: 350000 } }
      });
      if (res2.statusCode !== 200 || !res2.body.success) throw new Error('Audit alias failed');
    });

    await runTest('AI Studio & Voice Aliases: /api/ai/product-studio/generate & /api/ai/voice-assistant/turn', async () => {
      const res1 = await client.request({
        method: 'POST',
        path: '/api/ai/product-studio/generate',
        body: { title: 'Váy Hoa Nhí Vintage', rawDescription: 'Váy hoa nhí dáng xòe vải voan tơ cao cấp' }
      });
      if (res1.statusCode !== 200 || !res1.body.success) throw new Error('Product studio alias failed');

      const res2 = await client.request({
        method: 'POST',
        path: '/api/ai/voice-assistant/turn',
        body: { message: 'Shop có áo sơ mi trắng không?' }
      });
      if (res2.statusCode !== 200 || !res2.body.success) throw new Error('Voice assistant alias failed');
    });

  } finally {
    await client.stop();
  }

  return results;
}
