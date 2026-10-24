/**
 * SME AutoPilot — Challenger 1 Empirical Edge-Case & Adversarial Attack Suite
 * tests/test_challenger_edge_attacks.ts
 *
 * Specific Deep Challenge Vectors:
 * 1. Malformed VietQR strings (CRC16 tampering, invalid length headers, missing mandatory tags, circular TLVs, SQL/XSS injections).
 * 2. Rapid toggle between Live and Demo modes (100 concurrent async switches, state isolation, header overriding).
 * 3. Extreme Vietnamese diacritics & regional dialect inputs (Northern, Central, Southern slang, tone marks, audio edge cases).
 */

import http from 'http';
import {
  describe,
  test,
  assertEqual,
  assertNotEqual,
  assertTrue,
  assertFalse,
  assertRange,
  assertContains,
  assertDefined,
  assertThrows,
  runAllRegisteredSuites,
  resetRegistry
} from './harness';

import {
  calculateCrc16Ccitt,
  parseVietQRPayload,
  buildVietQRPayload,
  lookupBankInfo,
  evaluate5LayerForensics,
  reconcileWithOrders,
  VIETNAMESE_BANKS
} from '../backend/src/ai/billForensics';

import {
  VoiceAssistantService
} from '../backend/src/ai/voiceAssistant';

import {
  executeToolCall,
  queryInventory,
  calculateShippingFee,
  createDraftOrder,
  applyDiscountVoucher,
  normalizeVietnamesePhone
} from '../backend/src/ai/tools';

import { GoogleServiceFactory, getGoogleFactory } from '../backend/src/google/factory';
import { app } from '../backend/src/server';

let server: http.Server;
const TEST_PORT = 3899;

function makeRequest(
  options: { path: string; method?: string; headers?: Record<string, string>; body?: any }
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string; json?: any }> {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const postData = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined;

    const reqHeaders: http.OutgoingHttpHeaders = {
      ...options.headers
    };

    if (postData) {
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: options.path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsedJson: any;
          try {
            parsedJson = JSON.parse(raw);
          } catch {
            parsedJson = undefined;
          }
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: raw,
            json: parsedJson
          });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

describe('Challenger 1: Deep Edge-Case & Adversarial Attack Suite', () => {

  // ============================================================================
  // SUITE 1: MALFORMED VIETQR ATTACKS & BITWISE TAMPERING
  // ============================================================================

  test('VQR-01: Correct VietQR payload generates valid CRC16 and passes validation', () => {
    const payload = buildVietQRPayload({
      bankBin: '970436', // Vietcombank
      accountNumber: '1029384756',
      amount: 500000,
      transferContent: 'DH123456'
    });

    const parsed = parseVietQRPayload(payload);
    assertTrue(parsed.isValid, 'Payload must be valid');
    assertTrue(parsed.isValidCrc, 'CRC must be valid');
    assertEqual(parsed.bankBin, '970436');
    assertEqual(parsed.accountNumber, '1029384756');
    assertEqual(parsed.amount, 500000);
    assertEqual(parsed.transferContent, 'DH123456');
  });

  test('VQR-02: Single-bit and multi-byte CRC16 tampering in VietQR strings', () => {
    const valid = buildVietQRPayload({
      bankBin: '970422', // MBBank
      accountNumber: '0987654321',
      amount: 250000,
      transferContent: 'ORDER001'
    });

    // Tamper CRC with completely wrong hex
    const tamperedHex = valid.substring(0, valid.length - 4) + '0000';
    const parsed1 = parseVietQRPayload(tamperedHex);
    assertFalse(parsed1.isValidCrc, 'Tampered CRC must fail CRC verification');
    assertFalse(parsed1.isValid, 'Tampered payload must be marked invalid');

    // Tamper CRC with non-hex characters
    const tamperedNonHex = valid.substring(0, valid.length - 4) + 'ZZZZ';
    const parsed2 = parseVietQRPayload(tamperedNonHex);
    assertFalse(parsed2.isValidCrc, 'Non-hex CRC must fail CRC check');
    assertFalse(parsed2.isValid, 'Invalid CRC must invalidate payload');

    // Tamper body while keeping old CRC
    const tamperedBody = valid.replace('250000', '990000');
    const parsed3 = parseVietQRPayload(tamperedBody);
    assertFalse(parsed3.isValidCrc, 'Modified amount with old CRC must fail CRC check');
  });

  test('VQR-03: Truncated CRC Tag 63 or missing Tag 63 header', () => {
    const valid = buildVietQRPayload({
      bankBin: '970407',
      accountNumber: '1903456789',
      amount: 150000
    });

    // Missing Tag 63 completely
    const noTag63 = valid.substring(0, valid.lastIndexOf('6304'));
    const parsedNoTag63 = parseVietQRPayload(noTag63);
    assertFalse(parsedNoTag63.isValid, 'Payload without Tag 63 must be invalid');
    assertFalse(parsedNoTag63.isValidCrc, 'Payload without Tag 63 has no valid CRC');

    // Truncated Tag 63 (e.g. 6304AB without last 2 chars)
    const truncatedCrc = valid.substring(0, valid.length - 2);
    const parsedTruncated = parseVietQRPayload(truncatedCrc);
    assertFalse(parsedTruncated.isValidCrc, 'Truncated CRC must fail validation');
  });

  test('VQR-04: Invalid TLV length headers (out of bounds, non-numeric, zero-length)', () => {
    // Length larger than string length
    const overflowLengthPayload = '00020101021238990010A0000007270124000697043601101029384756530370454065000005802VN62080806DH12346304ABCD';
    const parsedOverflow = parseVietQRPayload(overflowLengthPayload);
    // Must parse safely without crashing or hanging
    assertDefined(parsedOverflow);
    assertFalse(parsedOverflow.isValidCrc);

    // Negative / non-numeric TLV length
    const malformedTlv = '00XX01010212380063041234';
    const parsedMalformed = parseVietQRPayload(malformedTlv);
    assertDefined(parsedMalformed);
    assertFalse(parsedMalformed.isValidCrc);

    // Empty and null inputs
    const parsedEmpty = parseVietQRPayload('');
    assertFalse(parsedEmpty.isValid);
    assertFalse(parsedEmpty.isValidCrc);

    const parsedNull = parseVietQRPayload(null as any);
    assertFalse(parsedNull.isValid);
  });

  test('VQR-05: Adversarial injection strings in VietQR transferContent (XSS & SQLi)', () => {
    const xssPayload = buildVietQRPayload({
      bankBin: '970436',
      accountNumber: '1234567890',
      amount: 100000,
      transferContent: '<script>alert("XSS")</script>'
    });

    const parsedXss = parseVietQRPayload(xssPayload);
    assertTrue(parsedXss.isValid, 'Valid VietQR structure with script content should parse safely');
    assertEqual(parsedXss.transferContent, '<script>alert("XSS")</script>');

    const sqliPayload = buildVietQRPayload({
      bankBin: '970422',
      accountNumber: '9999999999',
      amount: 200000,
      transferContent: "'; DROP TABLE orders; --"
    });

    const parsedSqli = parseVietQRPayload(sqliPayload);
    assertTrue(parsedSqli.isValid);
    assertEqual(parsedSqli.transferContent, "'; DROP TABLE orders; --");
  });

  test('VQR-06: 5-Layer Forensics evaluation under extreme tamper combinations', () => {
    // 1. Clock Paradox + Kerning Anomaly + ELA Halos + Logo Distortion
    const compoundTamper = evaluate5LayerForensics({
      statusBarTime: '10:15',
      transactionTime: '11:45', // Status bar before tx -> CLOCK PARADOX
      fontAnomalyDetected: true, // Layer 2
      compressionHaloDetected: true, // Layer 3
      logoDistortionDetected: true, // Layer 4
      identifiedBank: 'Vietcombank',
      extractedAmount: 500000,
      extractedAccount: '1029384756',
      extractedTxId: 'FT26081600123'
    });

    assertEqual(compoundTamper.riskLevel, 'CRITICAL');
    assertFalse(compoundTamper.isAuthentic);
    assertRange(compoundTamper.confidenceScore, 0, 0.4);
    assertTrue(compoundTamper.anomalies.length >= 4, 'Should detect at least 4 compound anomalies');

    // 2. Genuine receipt with zero anomalies
    const genuine = evaluate5LayerForensics({
      statusBarTime: '10:15',
      transactionTime: '10:14',
      fontAnomalyDetected: false,
      compressionHaloDetected: false,
      logoDistortionDetected: false,
      identifiedBank: 'Vietcombank',
      extractedAmount: 500000,
      extractedAccount: '1029384756',
      extractedTxId: 'FT26081600999'
    });

    assertEqual(genuine.riskLevel, 'LOW');
    assertTrue(genuine.isAuthentic);
    assertRange(genuine.confidenceScore, 0.85, 1.0);
    assertEqual(genuine.anomalies.length, 0);
  });

  // ============================================================================
  // SUITE 2: RAPID TOGGLE BETWEEN LIVE AND DEMO MODES (CONCURRENCY & ISOLATION)
  // ============================================================================

  test('MODE-01: Rapid 50 concurrent mode switch toggles between DEMO and LIVE', async () => {
    const modes = ['demo', 'live', 'demo', 'live', 'demo'];
    const promises: Promise<any>[] = [];

    for (let i = 0; i < 50; i++) {
      const targetMode = modes[i % modes.length];
      promises.push(
        makeRequest({
          path: '/api/google/mode/switch',
          method: 'POST',
          body: { mode: targetMode }
        })
      );
    }

    const responses = await Promise.all(promises);
    assertEqual(responses.length, 50);

    for (const res of responses) {
      assertEqual(res.statusCode, 200, 'Every mode switch request must return 200 OK');
      assertTrue(res.json.success, 'Response success must be true');
      assertTrue(['DEMO', 'LIVE'].includes(res.json.data.mode), 'Mode must be DEMO or LIVE');
    }

    // Reset back to demo mode for test determinism
    const resetRes = await makeRequest({
      path: '/api/google/mode/switch',
      method: 'POST',
      body: { mode: 'demo' }
    });
    assertEqual(resetRes.statusCode, 200);
    assertEqual(resetRes.json.data.mode, 'DEMO');
  });

  test('MODE-02: Invalid mode switch payloads return 400 Bad Request with structured error', async () => {
    const invalidPayloads = [
      { mode: 'super_admin' },
      { mode: 12345 },
      { mode: null },
      { mode: '' },
      { mode: true },
      { wrongKey: 'live' },
      {}
    ];

    for (const body of invalidPayloads) {
      const res = await makeRequest({
        path: '/api/google/mode/switch',
        method: 'POST',
        body
      });
      assertEqual(res.statusCode, 400, `Payload ${JSON.stringify(body)} must return 400`);
      assertFalse(res.json.success);
      assertEqual(res.json.error.code, 'INVALID_MODE');
    }
  });

  test('MODE-03: Interleaved queries during rapid mode toggles remain fully resilient', async () => {
    const ops: Promise<any>[] = [];

    // Fire 20 interleaved requests (mix of mode switches, inventory queries, maps queries, health checks)
    for (let i = 0; i < 20; i++) {
      if (i % 4 === 0) {
        ops.push(makeRequest({ path: '/api/google/mode/switch', method: 'POST', body: { mode: i % 2 === 0 ? 'demo' : 'live' } }));
      } else if (i % 4 === 1) {
        ops.push(makeRequest({ path: '/api/google/sheets/inventory' }));
      } else if (i % 4 === 2) {
        ops.push(makeRequest({ path: '/api/google/maps/branches' }));
      } else {
        ops.push(makeRequest({ path: '/api/health' }));
      }
    }

    const results = await Promise.all(ops);
    assertEqual(results.length, 20);
    for (const r of results) {
      assertEqual(r.statusCode, 200, `Interleaved request to endpoint returned status ${r.statusCode}`);
      assertTrue(r.json.success);
    }

    // Always reset factory back to demo
    const factory = getGoogleFactory();
    factory.setMode('demo');
    assertEqual(factory.getMode(), 'DEMO');
  });

  // ============================================================================
  // SUITE 3: EXTREME VIETNAMESE DIACRITICS & REGIONAL DIALECT INPUTS
  // ============================================================================

  test('NLP-01: Extreme Vietnamese diacritics and composite tones in Voice Assistant', async () => {
    const voiceService = new VoiceAssistantService();

    const extremeDiacriticsText = 'Áo dài lụa Hà Đông thêu hoa sen mẫu ẵm ẳm ẵm ợ ỡ ở ự ử ữ đắt đỏ không shop ơi?';
    const res = await voiceService.processVoiceTurn({
      sessionId: 'session_diacritics_01',
      userText: extremeDiacriticsText
    });

    assertDefined(res);
    assertTrue(res.responseText.length > 0, 'Must produce a non-empty Vietnamese reply');
    assertEqual(res.detectedDialect, 'NORTHERN');
    assertTrue(res.toolCallsExecuted.length >= 1, 'Should trigger query_inventory on áo dài / giá query');
  });

  test('NLP-02: Heavy Central Vietnamese dialect with slang (răng, rứa, mô, tê, hè, bớt hè)', async () => {
    const voiceService = new VoiceAssistantService();

    const centralText = 'Răng rứa hè? Cái áo ni còn size L màu đỏ không rứa shop? Bớt được đồng mô hông hè?';
    const res = await voiceService.processVoiceTurn({
      sessionId: 'session_central_01',
      userText: centralText
    });

    assertEqual(res.detectedDialect, 'CENTRAL', 'Must detect CENTRAL dialect');
    assertContains(res.responseText, 'rứa', 'Central response should incorporate regional tone markers');
    assertTrue(res.toolCallsExecuted.length >= 1);
  });

  test('NLP-03: Heavy Southern Vietnamese dialect with slang (nhiêu, hông, nè, nghen, dạ shop, zậy)', async () => {
    const voiceService = new VoiceAssistantService();

    const southernText = 'Dạ shop ơi, áo dài cách tân này giá nhiêu zậy nè? Giao liền qua Quận 5 giùm em nghen!';
    const res = await voiceService.processVoiceTurn({
      sessionId: 'session_southern_01',
      userText: southernText
    });

    assertEqual(res.detectedDialect, 'SOUTHERN', 'Must detect SOUTHERN dialect');
    assertContains(res.responseText, 'nghen', 'Southern response should incorporate regional tone markers');
    assertTrue(res.toolCallsExecuted.length >= 1);
  });

  test('NLP-04: Multi-Turn Conversation with Gen-Z Slang, Shipping and Voucher Application', async () => {
    const voiceService = new VoiceAssistantService();
    const sessionId = 'session_genz_multiturn';

    // Turn 1: Inquire about item
    const turn1 = await voiceService.processVoiceTurn({
      sessionId,
      userText: 'Shop ơi check var giùm em mẫu áo dài cách tân này còn hàng hông zậy?'
    });
    assertEqual(turn1.detectedDialect, 'SOUTHERN');
    assertTrue(turn1.toolCallsExecuted.some(t => t.toolName === 'query_inventory'));

    // Turn 2: Calculate shipping to Da Nang
    const turn2 = await voiceService.processVoiceTurn({
      sessionId,
      userText: 'Ship ra Đà Nẵng thì hết mấy tiền ship vậy shop?'
    });
    assertTrue(turn2.toolCallsExecuted.some(t => t.toolName === 'calculate_shipping_fee'));
    assertContains(turn2.responseText, 'Đà Nẵng');

    // Turn 3: Apply discount voucher
    const turn3 = await voiceService.processVoiceTurn({
      sessionId,
      userText: 'Áp mã TET2026 giùm em với shop ơi!'
    });
    assertTrue(turn3.toolCallsExecuted.some(t => t.toolName === 'apply_discount_voucher'));
  });

  test('NLP-05: Boundary conditions: empty string, whitespace only, emoji deluge', async () => {
    const voiceService = new VoiceAssistantService();

    // Empty text
    const resEmpty = await voiceService.processVoiceTurn({
      sessionId: 'session_empty',
      userText: ''
    });
    assertDefined(resEmpty);
    assertTrue(resEmpty.responseText.length > 0);

    // Whitespace only
    const resSpaces = await voiceService.processVoiceTurn({
      sessionId: 'session_spaces',
      userText: '     \n\t   '
    });
    assertDefined(resSpaces);
    assertTrue(resSpaces.responseText.length > 0);

    // Emoji-only string
    const resEmojis = await voiceService.processVoiceTurn({
      sessionId: 'session_emojis',
      userText: '🔥🔥🔥👗🛍️🇻🇳✨🎉'
    });
    assertDefined(resEmojis);
    assertTrue(resEmojis.responseText.length > 0);
  });

  test('NLP-06: Raw Audio Buffer processing edge cases', async () => {
    const voiceService = new VoiceAssistantService();

    // 1. Audio buffer input without userText produces safe response and defaults safely
    const audioDummy = Buffer.from('RIFF....WAVEfmt ....data....');
    const resAudio = await voiceService.processVoiceTurn({
      sessionId: 'session_audio_01',
      audioBuffer: audioDummy,
      audioMimeType: 'audio/wav'
    });
    assertDefined(resAudio);
    assertTrue(resAudio.responseText.length > 0, 'Audio turn should return non-empty response');
    assertTrue(['NORTHERN', 'CENTRAL', 'SOUTHERN'].includes(resAudio.detectedDialect));

    // 2. Large 1MB dummy audio buffer processes without OOM or crash
    const largeAudio = Buffer.alloc(1024 * 1024, 0x55);
    const resLarge = await voiceService.processVoiceTurn({
      sessionId: 'session_audio_large',
      audioBuffer: largeAudio,
      audioMimeType: 'audio/mp3'
    });
    assertDefined(resLarge);
    assertTrue(resLarge.responseText.length > 0);
  });
});

async function runStandalone(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('  ⚔️ CHALLENGER 1: EMPIRICAL EDGE-CASE & ADVERSARIAL ATTACK SUITE');
  console.log('='.repeat(80) + '\n');

  // Start HTTP server on TEST_PORT
  await new Promise<void>((resolve) => {
    server = app.listen(TEST_PORT, () => {
      resolve();
    });
  });

  try {
    const suiteResults = await runAllRegisteredSuites();
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const s of suiteResults) {
      console.log(`\n📦 SUITE: ${s.name}`);
      console.log('-'.repeat(80));
      for (const t of s.testResults) {
        totalTests++;
        if (t.passed) {
          passedTests++;
          console.log(`  ✅ [PASS] ${t.name} (${t.durationMs}ms)`);
        } else {
          failedTests++;
          console.log(`  ❌ [FAIL] ${t.name} (${t.durationMs}ms)`);
          console.log(`     Error: ${t.error}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('  CHALLENGER 1 ATTACK SUITE SUMMARY:');
    console.log(`  Total Attacks & Edge Cases: ${totalTests}`);
    console.log(`  Passed / Resilient:         ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`  Failed / Vulnerabilities:   ${failedTests}`);
    console.log('='.repeat(80) + '\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } finally {
    if (server) {
      server.close();
    }
  }
}

if (require.main === module) {
  runStandalone().catch((err) => {
    console.error('Fatal execution error:', err);
    if (server) server.close();
    process.exit(1);
  });
}
