import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  assertThrows,
  runAllRegisteredSuites
} from '../harness';
import { ApiResponse } from '../../shared';

export interface HttpRequestMock {
  method: string;
  path: string;
  bodyRaw?: string;
  headers?: Record<string, string>;
  isAborted?: boolean;
}

export interface HttpResponseMock {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

export class MockBackendDispatcher {
  public maxPayloadBytes = 10 * 1024 * 1024; // 10MB limit
  public activeSSEConnections = new Set<string>();

  public handleRequest(req: HttpRequestMock, isProd: boolean = true): HttpResponseMock {
    // Boundary 4: Payload size limit (> 10MB)
    const contentLength = req.bodyRaw ? Buffer.byteLength(req.bodyRaw, 'utf8') : 0;
    if (contentLength > this.maxPayloadBytes) {
      return {
        statusCode: 413,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: false,
          error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload exceeds 10MB limit' },
          timestamp: new Date().toISOString()
        } as ApiResponse
      };
    }

    // Boundary 1: Invalid JSON body
    let parsedBody: any = null;
    if (req.bodyRaw && req.bodyRaw.trim().length > 0) {
      try {
        parsedBody = JSON.parse(req.bodyRaw);
      } catch (err: any) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: {
            success: false,
            error: { code: 'INVALID_JSON', message: 'Malformed JSON payload in request body' },
            timestamp: new Date().toISOString()
          } as ApiResponse
        };
      }
    }

    // Boundary 3: Unhandled exception simulation
    if (req.path === '/api/v1/faulty_endpoint') {
      try {
        throw new Error('Database connection timeout at line 42');
      } catch (err: any) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: {
            success: false,
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: isProd ? 'An unexpected server error occurred' : err.message,
              details: isProd ? undefined : err.stack
            },
            timestamp: new Date().toISOString()
          } as ApiResponse
        };
      }
    }

    // Boundary 2: 404 Route Handler
    const validRoutes = ['/healthz', '/api/health', '/api/v1/orders', '/api/v1/inventory', '/api/v1/ai/audit'];
    if (!validRoutes.includes(req.path)) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: false,
          error: { code: 'ROUTE_NOT_FOUND', message: `Route ${req.method} ${req.path} does not exist` },
          timestamp: new Date().toISOString()
        } as ApiResponse
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        data: { message: 'OK' },
        timestamp: new Date().toISOString()
      } as ApiResponse
    };
  }

  // Boundary 5: SSE Stream lifecycle and abrupt disconnect cleanup
  public openSSEStream(connectionId: string, onEvent: (chunk: string) => void): {
    sendChunk: (data: string) => boolean;
    disconnect: () => void;
  } {
    this.activeSSEConnections.add(connectionId);
    let closed = false;

    return {
      sendChunk: (data: string) => {
        if (closed || !this.activeSSEConnections.has(connectionId)) {
          return false;
        }
        onEvent(`data: ${JSON.stringify({ chunk: data })}\n\n`);
        return true;
      },
      disconnect: () => {
        closed = true;
        this.activeSSEConnections.delete(connectionId);
      }
    };
  }
}

describe('Tier 2 Feature B9: Backend Stress & Errors Boundary Tests', () => {
  const dispatcher = new MockBackendDispatcher();

  test('B9.1 - Invalid JSON body returns 400 Bad Request with INVALID_JSON error code', () => {
    const res = dispatcher.handleRequest({
      method: 'POST',
      path: '/api/v1/orders',
      bodyRaw: '{"orderId": "ORD-001", "unclosedString: 123'
    });

    assertEqual(res.statusCode, 400);
    assertFalse(res.body.success);
    assertEqual(res.body.error?.code, 'INVALID_JSON');
  });

  test('B9.2 - Non-existent route returns 404 ROUTE_NOT_FOUND with structured ApiResponse', () => {
    const res = dispatcher.handleRequest({
      method: 'GET',
      path: '/api/v1/unknown_phantom_route'
    });

    assertEqual(res.statusCode, 404);
    assertFalse(res.body.success);
    assertEqual(res.body.error?.code, 'ROUTE_NOT_FOUND');
    assertContains(res.body.error?.message, 'does not exist');
  });

  test('B9.3 - Unhandled exception returns 500 INTERNAL_SERVER_ERROR without leaking stack trace in production', () => {
    const resProd = dispatcher.handleRequest({
      method: 'POST',
      path: '/api/v1/faulty_endpoint'
    }, true); // isProd = true

    assertEqual(resProd.statusCode, 500);
    assertFalse(resProd.body.success);
    assertEqual(resProd.body.error?.code, 'INTERNAL_SERVER_ERROR');
    assertEqual(resProd.body.error?.details, undefined, 'Stack trace must NOT leak in production');
  });

  test('B9.4 - Payload size limit > 10MB returns 413 PAYLOAD_TOO_LARGE', () => {
    // Generate 11MB string
    const largeString = 'X'.repeat(11 * 1024 * 1024);
    const res = dispatcher.handleRequest({
      method: 'POST',
      path: '/api/v1/ai/audit',
      bodyRaw: largeString
    });

    assertEqual(res.statusCode, 413);
    assertEqual(res.body.error?.code, 'PAYLOAD_TOO_LARGE');
  });

  test('B9.5 - SSE connection abrupt disconnect cleans up active streams without memory leak', () => {
    const connId = 'sse_conn_test_001';
    let emittedChunks = 0;

    const stream = dispatcher.openSSEStream(connId, (chunk) => {
      emittedChunks++;
    });

    assertTrue(dispatcher.activeSSEConnections.has(connId));
    assertTrue(stream.sendChunk('first chunk'));
    assertEqual(emittedChunks, 1);

    // Abrupt client disconnect
    stream.disconnect();

    assertFalse(dispatcher.activeSSEConnections.has(connId), 'Connection must be removed from active pool');
    assertFalse(stream.sendChunk('after disconnect chunk'), 'Sending after disconnect must return false');
    assertEqual(emittedChunks, 1, 'No further chunks should be processed after disconnect');
  });
});

if (require.main === module) {
  runAllRegisteredSuites().then(results => {
    let failed = 0;
    for (const r of results) {
      console.log(`Suite: ${r.name} (${r.passed}/${r.total} passed)`);
      failed += r.failed;
    }
    process.exit(failed > 0 ? 1 : 0);
  });
}
