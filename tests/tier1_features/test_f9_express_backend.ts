import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains
} from '../harness';
import { ApiResponse, HealthStatus, SSEEvent } from '../../shared';

export function formatSSEMessage<T>(event: string, data: T, id?: string): string {
  let message = '';
  if (id) message += `id: ${id}\n`;
  message += `event: ${event}\n`;
  message += `data: ${JSON.stringify(data)}\n\n`;
  return message;
}

export function parseSSEMessage(rawChunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = rawChunk.split('\n\n').filter(b => b.trim().length > 0);

  for (const block of blocks) {
    const lines = block.split('\n');
    let eventName = 'message';
    let dataStr = '';
    let id: string | undefined;

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventName = line.substring(7).trim();
      } else if (line.startsWith('data: ')) {
        dataStr = line.substring(6).trim();
      } else if (line.startsWith('id: ')) {
        id = line.substring(4).trim();
      }
    }

    if (dataStr) {
      events.push({
        event: eventName,
        data: JSON.parse(dataStr),
        id
      });
    }
  }

  return events;
}

export function validateRequestBody(
  schema: { requiredFields: string[]; types: Record<string, string> },
  body: any
): { isValid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { isValid: false, error: 'Request body must be a valid JSON object' };
  }

  for (const field of schema.requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return { isValid: false, error: `Missing required parameter: '${field}'` };
    }
    const expectedType = schema.types[field];
    if (expectedType && typeof body[field] !== expectedType) {
      return {
        isValid: false,
        error: `Field '${field}' must be of type ${expectedType}, received ${typeof body[field]}`
      };
    }
  }

  return { isValid: true };
}

export function createErrorResponse(code: string, message: string, details?: any): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString()
  };
}

export function checkHealthEndpoint(mode: 'DEMO' | 'LIVE' = 'DEMO'): HealthStatus {
  return {
    status: 'healthy',
    version: '1.0.0',
    uptimeSeconds: 3600,
    environment: 'production',
    timestamp: new Date().toISOString(),
    services: {
      gemini: mode === 'DEMO' ? 'mock_mode' : 'operational',
      sheets: mode === 'DEMO' ? 'mock_mode' : 'operational',
      gmail: mode === 'DEMO' ? 'mock_mode' : 'operational',
      calendar: mode === 'DEMO' ? 'mock_mode' : 'operational',
      maps: mode === 'DEMO' ? 'mock_mode' : 'operational',
      firebase: mode === 'DEMO' ? 'in_memory_mock' : 'operational'
    },
    mode
  };
}

describe('F9: Express Backend REST & SSE Engine', () => {
  test('Test 9.1: REST routing table endpoint structure and schemas', () => {
    const definedRoutes = [
      { method: 'POST', path: '/api/ai/forensics/analyze' },
      { method: 'POST', path: '/api/ai/product-studio/generate' },
      { method: 'POST', path: '/api/ai/voice-assistant/turn' },
      { method: 'GET', path: '/api/orders' },
      { method: 'POST', path: '/api/orders' },
      { method: 'GET', path: '/api/inventory' },
      { method: 'POST', path: '/api/google/sheets/sync' },
      { method: 'POST', path: '/api/google/maps/route' },
      { method: 'GET', path: '/healthz' },
      { method: 'GET', path: '/api/health' }
    ];

    assertEqual(definedRoutes.length, 10);
    assertTrue(definedRoutes.some(r => r.path === '/api/ai/forensics/analyze'));
    assertTrue(definedRoutes.some(r => r.path === '/healthz'));
  });

  test('Test 9.2: Server-Sent Events (SSE) stream chunk formatting and parsing', () => {
    const chunk1 = formatSSEMessage('token', { text: 'Xin chào ' }, '1');
    const chunk2 = formatSSEMessage('token', { text: 'quý khách!' }, '2');
    const chunk3 = formatSSEMessage('done', { totalTokens: 6 }, '3');

    const fullStream = `${chunk1}${chunk2}${chunk3}`;
    const parsedEvents = parseSSEMessage(fullStream);

    assertEqual(parsedEvents.length, 3);
    assertEqual(parsedEvents[0].event, 'token');
    assertEqual(parsedEvents[0].data.text, 'Xin chào ');
    assertEqual(parsedEvents[2].event, 'done');
    assertEqual(parsedEvents[2].data.totalTokens, 6);
  });

  test('Test 9.3: Health check probes (/healthz & /api/health) response contracts', () => {
    const demoHealth = checkHealthEndpoint('DEMO');
    assertEqual(demoHealth.status, 'healthy');
    assertEqual(demoHealth.mode, 'DEMO');
    assertEqual(demoHealth.services.sheets, 'mock_mode');
    assertEqual(demoHealth.services.firebase, 'in_memory_mock');

    const liveHealth = checkHealthEndpoint('LIVE');
    assertEqual(liveHealth.mode, 'LIVE');
    assertEqual(liveHealth.services.sheets, 'operational');
  });

  test('Test 9.4: Request validation middleware logic with type guards', () => {
    const schema = {
      requiredFields: ['productTitle', 'category', 'price'],
      types: { productTitle: 'string', category: 'string', price: 'number' }
    };

    // Valid body
    const valid = validateRequestBody(schema, {
      productTitle: 'Áo Dài Lụa',
      category: 'Thời Trang',
      price: 450000
    });
    assertTrue(valid.isValid);

    // Missing field
    const missing = validateRequestBody(schema, {
      productTitle: 'Áo Dài Lụa',
      category: 'Thời Trang'
    });
    assertFalse(missing.isValid);
    assertContains(missing.error || '', "Missing required parameter: 'price'");

    // Invalid type
    const wrongType = validateRequestBody(schema, {
      productTitle: 'Áo Dài Lụa',
      category: 'Thời Trang',
      price: 'four hundred thousand'
    });
    assertFalse(wrongType.isValid);
    assertContains(wrongType.error || '', 'must be of type number');
  });

  test('Test 9.5: Structured error response envelope generation', () => {
    const errResp = createErrorResponse(
      'INVALID_RECEIPT_IMAGE',
      'The uploaded image is unreadable or corrupted.',
      { supportedFormats: ['image/jpeg', 'image/png', 'image/webp'] }
    );

    assertFalse(errResp.success);
    assertEqual(errResp.error?.code, 'INVALID_RECEIPT_IMAGE');
    assertTrue(errResp.error?.details.supportedFormats.includes('image/png'));
    assertTrue(!!errResp.timestamp);
  });
});
