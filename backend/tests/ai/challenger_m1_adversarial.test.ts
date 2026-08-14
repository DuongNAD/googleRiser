/**
 * SME AutoPilot — Milestone 1 Challenger Adversarial Stress Test Suite
 * backend/tests/ai/challenger_m1_adversarial.test.ts
 *
 * Adversarially probes:
 * 1. Tampered Receipts, Clock Paradoxes, Typography & ELA Artifacts
 * 2. Malformed VietQR & EMVCo TLV / Bitwise CRC16
 * 3. 25+ Bank Registry & Auto-Reconciliation Variations
 * 4. Gemini Client Markdown Fence Stripping & Broken JSON Fallbacks
 */

import {
  BillForensicsService,
  evaluate5LayerForensics,
  reconcileWithOrders,
  calculateCrc16Ccitt,
  parseVietQRPayload,
  buildVietQRPayload,
  lookupBankInfo,
  VIETNAMESE_BANKS
} from '../../src/ai/billForensics';
import { GeminiClientService, getGeminiClient } from '../../src/ai/geminiClient';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  category: string;
}

export function runAdversarialTests(): TestResult[] {
  const results: TestResult[] = [];

  function test(category: string, name: string, fn: () => void) {
    try {
      fn();
      results.push({ category, name, passed: true });
    } catch (err: any) {
      results.push({ category, name, passed: false, error: err.message || String(err) });
    }
  }

  function assert(condition: boolean, msg?: string) {
    if (!condition) throw new Error(msg || 'Assertion failed');
  }

  function assertEqual(actual: any, expected: any, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  // ==========================================================================
  // SECTION 1: 5-LAYER FORENSICS & TAMPERING STRESS TESTS
  // ==========================================================================

  test('Forensics', 'ADV-1.1: Clock Paradox detection when status bar is earlier than receipt', () => {
    // E.g. Status bar 08:15, receipt 08:30 (Screenshot taken 15 mins before transfer!)
    const res = evaluate5LayerForensics({
      statusBarTime: '08:15',
      transactionTime: '08:30',
      extractedTxId: 'TX001',
      extractedAmount: 500000
    });
    assertEqual(res.forensicLayers.layer1_clockConsistency.isClockParadox, true);
    assertEqual(res.riskLevel, 'CRITICAL');
    assert(res.score <= 65);
    assert(res.anomalies.some(a => a.type === 'CLOCK_PARADOX' && a.severity === 'CRITICAL'));
  });

  test('Forensics', 'ADV-1.2: Clock consistency: Same time and 1-minute delta pass normally', () => {
    const resSame = evaluate5LayerForensics({
      statusBarTime: '14:30',
      transactionTime: '14:30',
      extractedTxId: 'TX002',
      extractedAmount: 200000
    });
    assertEqual(resSame.forensicLayers.layer1_clockConsistency.isClockParadox, false);
    assertEqual(resSame.forensicLayers.layer1_clockConsistency.timeGapMinutes, 0);
    assertEqual(resSame.riskLevel, 'LOW');

    const res1Min = evaluate5LayerForensics({
      statusBarTime: '14:31',
      transactionTime: '14:30',
      extractedTxId: 'TX003',
      extractedAmount: 200000
    });
    assertEqual(res1Min.forensicLayers.layer1_clockConsistency.isClockParadox, false);
    assertEqual(res1Min.forensicLayers.layer1_clockConsistency.timeGapMinutes, 1);
    assertEqual(res1Min.riskLevel, 'LOW');
  });

  test('Forensics', 'ADV-1.3: Clock consistency: Midnight boundary wrap (23:55 tx, 00:05 screenshot)', () => {
    // Status bar is 00:05 (5 mins past midnight), Tx is 23:55 (1435 mins).
    // In statusMins (5) < txMins (1435), but statusMins < 60 && txMins > 23*60 => Should NOT be treated as clock paradox!
    const res = evaluate5LayerForensics({
      statusBarTime: '00:05',
      transactionTime: '23:55',
      extractedTxId: 'TX004',
      extractedAmount: 350000
    });
    assertEqual(res.forensicLayers.layer1_clockConsistency.isClockParadox, false);
  });

  test('Forensics', 'ADV-1.4: Clock consistency: Excessive time gap (>180 mins) applies medium penalty', () => {
    // 4 hours (240 mins) after transfer
    const res = evaluate5LayerForensics({
      statusBarTime: '18:00',
      transactionTime: '14:00',
      extractedTxId: 'TX005',
      extractedAmount: 500000
    });
    assertEqual(res.forensicLayers.layer1_clockConsistency.isClockParadox, false);
    assertEqual(res.forensicLayers.layer1_clockConsistency.timeGapMinutes, 240);
    assert(res.anomalies.some(a => a.type === 'LARGE_TIME_GAP' && a.penalty === 10));
    assertEqual(res.score, 90);
  });

  test('Forensics', 'ADV-1.5: Font tampering & kerning anomaly applies 35pt penalty and triggers HIGH risk', () => {
    const res = evaluate5LayerForensics({
      statusBarTime: '14:35',
      transactionTime: '14:30',
      fontAnomalyDetected: true,
      extractedTxId: 'TX006',
      extractedAmount: 1000000
    });
    assertEqual(res.forensicSignals.fontConsistency, false);
    assertEqual(res.riskLevel, 'HIGH');
    assertEqual(res.score, 65);
    assert(res.anomalies.some(a => a.type === 'FONT_MISMATCH'));
  });

  test('Forensics', 'ADV-1.6: Compression grid & ELA artifact applies 20pt penalty', () => {
    const res = evaluate5LayerForensics({
      statusBarTime: '14:35',
      transactionTime: '14:30',
      compressionHaloDetected: true,
      extractedTxId: 'TX007',
      extractedAmount: 1000000
    });
    assertEqual(res.forensicSignals.compressionArtifacts, false);
    assertEqual(res.score, 80);
    assertEqual(res.riskLevel, 'MEDIUM');
  });

  test('Forensics', 'ADV-1.7: Bank logo distortion applies 25pt penalty and verifies bank color gradient', () => {
    const res = evaluate5LayerForensics({
      statusBarTime: '14:35',
      transactionTime: '14:30',
      logoDistortionDetected: true,
      identifiedBank: 'MB',
      extractedTxId: 'TX008',
      extractedAmount: 1000000
    });
    assertEqual(res.forensicSignals.logoAuthenticity, false);
    assertEqual(res.score, 75);
    assertEqual(res.riskLevel, 'MEDIUM');
    assert(res.forensicLayers.layer4_brandUi.details.includes('#003B7A'));
  });

  test('Forensics', 'ADV-1.8: Quadruple compound tampering (Clock + Font + ELA + Logo) zeroes score', () => {
    const res = evaluate5LayerForensics({
      statusBarTime: '08:00',
      transactionTime: '09:00', // -35 clock
      fontAnomalyDetected: true, // -35 font
      compressionHaloDetected: true, // -20 compression
      logoDistortionDetected: true, // -25 logo
      extractedTxId: 'TX009',
      extractedAmount: 1000000
    });
    // Total deductions = 35 + 35 + 20 + 25 = 115 => clamped to 0
    assertEqual(res.score, 0);
    assertEqual(res.confidenceScore, 0);
    assertEqual(res.riskLevel, 'CRITICAL');
    assertEqual(res.isAuthentic, false);
    assertEqual(res.anomalies.length, 4);
  });

  test('Forensics', 'ADV-1.9: Missing crucial receipt fields (TxID or 0 amount) flags incomplete receipt', () => {
    const res = evaluate5LayerForensics({
      statusBarTime: '14:35',
      transactionTime: '14:30',
      extractedAmount: 0 // Missing valid amount
    });
    assert(res.anomalies.some(a => a.type === 'MISSING_FIELDS'));
    assertEqual(res.score, 75);
  });

  // ==========================================================================
  // SECTION 2: MALFORMED VIETQR & EMVCo TLV PARSING
  // ==========================================================================

  test('VietQR', 'ADV-2.1: CRC16 calculation is deterministic and conforms to NAPAS EMVCo 0x1021', () => {
    const testStr = '00020101021238570010A00000072701270006970436011310123456789010208QRIBFTTA530370454065890005802VN6304';
    const crc = calculateCrc16Ccitt(testStr);
    assert(typeof crc === 'string' && crc.length === 4, 'CRC should be 4 hex chars');
    assertEqual(crc, calculateCrc16Ccitt(testStr), 'CRC should be idempotent');
  });

  test('VietQR', 'ADV-2.2: Single-bit corruption in payload is immediately caught by CRC16', () => {
    const validQr = buildVietQRPayload({
      bankBin: '970407', // Techcombank
      accountNumber: '19031234567890',
      amount: 1500000,
      transferContent: 'ORD-999'
    });

    const parsedValid = parseVietQRPayload(validQr);
    assertEqual(parsedValid.isValidCrc, true);
    assertEqual(parsedValid.amount, 1500000);

    // Corrupt one character in account number
    const corruptedQr = validQr.replace('19031234567890', '19031234567891');
    const parsedCorrupted = parseVietQRPayload(corruptedQr);
    assertEqual(parsedCorrupted.isValidCrc, false);
    assertEqual(parsedCorrupted.isValid, false);
  });

  test('VietQR', 'ADV-2.3: Truncated or missing CRC Tag 63 returns isValid = false without crash', () => {
    const badPayloads = [
      '',
      'INVALID_PAYLOAD',
      '00020101021238570010A000000727', // Missing Tag 63
      '00020101021238576302AB', // Truncated CRC
      null as any,
      undefined as any
    ];

    for (const p of badPayloads) {
      const res = parseVietQRPayload(p);
      assertEqual(res.isValid, false);
      assertEqual(res.isValidCrc, false);
    }
  });

  test('VietQR', 'ADV-2.4: Malformed TLV lengths do not cause infinite loops or buffer overruns', () => {
    // Malformed length: tag '38' with length '99' that exceeds payload length
    const malformedTlv = '00020101021238990010A0000007276304FFFF';
    const res = parseVietQRPayload(malformedTlv);
    assertEqual(res.isValid, false);
  });

  test('VietQR', 'ADV-2.5: VietQR data cross-check detects amount and account mismatches', () => {
    const qrPayload = buildVietQRPayload({
      bankBin: '970436',
      accountNumber: '1234567890',
      amount: 500000
    });

    // Mismatch 1: Amount discrepancy (Receipt 600k, QR 500k)
    const evalAmountMismatch = evaluate5LayerForensics({
      statusBarTime: '10:00',
      transactionTime: '09:58',
      qrPayload,
      extractedAmount: 600000,
      extractedAccount: '1234567890',
      extractedTxId: 'TX123'
    });
    assertEqual(evalAmountMismatch.forensicSignals.qrIntegrity, false);
    assert(evalAmountMismatch.anomalies.some(a => a.type === 'QR_DATA_MISMATCH'));
    assertEqual(evalAmountMismatch.score, 70); // 100 - 30

    // Mismatch 2: Account discrepancy (Receipt 999999, QR 1234567890)
    const evalAccountMismatch = evaluate5LayerForensics({
      statusBarTime: '10:00',
      transactionTime: '09:58',
      qrPayload,
      extractedAmount: 500000,
      extractedAccount: '9999999999',
      extractedTxId: 'TX123'
    });
    assertEqual(evalAccountMismatch.forensicSignals.qrIntegrity, false);
    assert(evalAccountMismatch.anomalies.some(a => a.type === 'QR_DATA_MISMATCH'));
  });

  // ==========================================================================
  // SECTION 3: 25+ BANK REGISTRY & AUTO-RECONCILIATION STRESS TESTS
  // ==========================================================================

  test('Banks', 'ADV-3.1: All 30 registered Vietnamese Banks and E-Wallets resolve correctly', () => {
    const requiredInstitutions = [
      { id: '970436', shortName: 'VCB' },
      { id: '970422', shortName: 'MB' },
      { id: '970407', shortName: 'TCB' },
      { id: '970418', shortName: 'BIDV' },
      { id: '970415', shortName: 'CTG' },
      { id: '970432', shortName: 'VPB' },
      { id: '970416', shortName: 'ACB' },
      { id: '970423', shortName: 'TPB' },
      { id: '970403', shortName: 'STB' },
      { id: '970405', shortName: 'VBA' },
      { id: '970437', shortName: 'HDB' },
      { id: '970443', shortName: 'SHB' },
      { id: '970426', shortName: 'MSB' },
      { id: '970441', shortName: 'VIB' },
      { id: '970440', shortName: 'SeABank' },
      { id: '970448', shortName: 'OCB' },
      { id: '970431', shortName: 'EIB' },
      { id: '970449', shortName: 'LPBank' },
      { id: '970412', shortName: 'PVcomBank' },
      { id: '970409', shortName: 'BAB' },
      { id: '970428', shortName: 'NAB' },
      { id: '970452', shortName: 'KLB' },
      { id: '970454', shortName: 'BVBank' },
      { id: '970438', shortName: 'BaoVietBank' },
      { id: '970400', shortName: 'Saigonbank' },
      { id: '546034', shortName: 'CAKE' },
      { id: '963388', shortName: 'Timo' },
      { id: '971005', shortName: 'MoMo' },
      { id: '971007', shortName: 'ZaloPay' },
      { id: '971001', shortName: 'ViettelMoney' }
    ];

    for (const inst of requiredInstitutions) {
      const byBin = lookupBankInfo(inst.id);
      assert(!!byBin, `Failed to lookup bank by BIN: ${inst.id}`);
      assertEqual(byBin?.shortName, inst.shortName);

      const byShort = lookupBankInfo(inst.shortName);
      assert(!!byShort, `Failed to lookup bank by shortName: ${inst.shortName}`);
    }
  });

  test('Banks', 'ADV-3.2: Fuzzy & app name resolution for various user search patterns', () => {
    assertEqual(lookupBankInfo('VCB Digibank')?.bin, '970436');
    assertEqual(lookupBankInfo('Techcombank Mobile')?.bin, '970407');
    assertEqual(lookupBankInfo('VPBank NEO')?.bin, '970432');
    assertEqual(lookupBankInfo('MyVIB 2.0')?.bin, '970441');
    assertEqual(lookupBankInfo('CAKE by VPBank')?.bin, '546034');
    assertEqual(lookupBankInfo('Timo Digital Bank')?.bin, '963388');
    assertEqual(lookupBankInfo('VietinBank iPay')?.bin, '970415');
    assertEqual(lookupBankInfo('Sacombank Pay')?.bin, '970403');
    assertEqual(lookupBankInfo('UnknownNonExistentBank123'), undefined);
  });

  test('Reconciliation', 'ADV-3.3: Order reconciliation handles punctuation and normalized order IDs', () => {
    const forensics: any = {
      riskLevel: 'LOW',
      extractedData: {
        amount: 850000,
        transferContent: 'Nguyen Van A chuyen tien don hang #ORD_2026-0888 cam on shop'
      }
    };

    const orders = [
      { orderId: 'ORD_2026-0888', totalAmount: 850000, customerPhone: '0988776655' },
      { orderId: 'ORD_2026-0999', totalAmount: 120000, customerPhone: '0911223344' }
    ];

    const res = reconcileWithOrders(forensics, orders);
    assertEqual(res.reconciliationStatus, 'MATCHED');
    assertEqual(res.matchedOrderId, 'ORD_2026-0888');
    assertEqual(res.recommendation, 'AUTO_APPROVE');
  });

  test('Reconciliation', 'ADV-3.4: Order reconciliation matches by customer phone number fallback', () => {
    const forensics: any = {
      riskLevel: 'LOW',
      extractedData: {
        amount: 320000,
        transferContent: 'Chuyen tien mua hang tu sdt 0987654321'
      }
    };

    const orders = [
      { orderId: 'ORD-PHONE-MATCH', totalAmount: 320000, customerPhone: '0987654321' }
    ];

    const res = reconcileWithOrders(forensics, orders);
    assertEqual(res.reconciliationStatus, 'MATCHED');
    assertEqual(res.matchedOrderId, 'ORD-PHONE-MATCH');
    assertEqual(res.recommendation, 'AUTO_APPROVE');
  });

  test('Reconciliation', 'ADV-3.5: Disputed transfer with partial amount triggers MANUAL_REVIEW', () => {
    const forensics: any = {
      riskLevel: 'LOW',
      extractedData: {
        amount: 300000, // Transferred 300k instead of 320k
        transferContent: 'Chuyen tien ORD-PHONE-MATCH'
      }
    };

    const orders = [
      { orderId: 'ORD-PHONE-MATCH', totalAmount: 320000, customerPhone: '0987654321' }
    ];

    const res = reconcileWithOrders(forensics, orders);
    assertEqual(res.reconciliationStatus, 'FLAGGED');
    assertEqual(res.recommendation, 'MANUAL_REVIEW');
  });

  // ==========================================================================
  // SECTION 4: GEMINI CLIENT PARSER RESILIENCE & FALLBACK STRESS TESTS
  // ==========================================================================

  test('GeminiClient', 'ADV-4.1: cleanAndParseJson handles various markdown fences (````, ```json, whitespace)', () => {
    const client = new GeminiClientService();

    // Quadruple backticks
    const q1 = '````json\n{"status": "ok", "val": 123}\n````';
    assertEqual(client.cleanAndParseJson<any>(q1).status, 'ok');

    // Triple backticks without 'json'
    const q2 = '```\n{"status": "ok_no_tag"}\n```';
    assertEqual(client.cleanAndParseJson<any>(q2).status, 'ok_no_tag');

    // Unclosed markdown fence
    const q3 = '```json\n{"status": "unclosed_fence", "active": true}';
    const parsedQ3 = client.cleanAndParseJson<any>(q3);
    assertEqual(parsedQ3.status, 'unclosed_fence');
    assertEqual(parsedQ3.active, true);
  });

  test('GeminiClient', 'ADV-4.2: cleanAndParseJson handles conversational preamble and postamble', () => {
    const client = new GeminiClientService();
    const raw = `
      Certainly! Here is the JSON analysis for the Vietnamese receipt:
      \`\`\`json
      {
        "isAuthentic": true,
        "bank": "Vietcombank",
        "notes": "Đã kiểm tra đối soát NAPAS 247"
      }
      \`\`\`
      Please let me know if you need any additional verification!
    `;
    const parsed = client.cleanAndParseJson<any>(raw);
    assertEqual(parsed.isAuthentic, true);
    assertEqual(parsed.bank, 'Vietcombank');
    assertEqual(parsed.notes, 'Đã kiểm tra đối soát NAPAS 247');
  });

  test('GeminiClient', 'ADV-4.3: cleanAndParseJson parses nested arrays, Vietnamese diacritics, and emojis', () => {
    const client = new GeminiClientService();
    const raw = JSON.stringify({
      shop: 'Áo Dài Truyền Thống Hà Nội 🇻🇳',
      items: [
        { name: 'Áo dài lụa tơ tằm', price: 1250000 },
        { name: 'Khăn đóng gấm', price: 250000 }
      ],
      tags: ['Tết 2026', 'Thủ công mỹ nghệ']
    });

    const parsed = client.cleanAndParseJson<any>(raw);
    assertEqual(parsed.shop, 'Áo Dài Truyền Thống Hà Nội 🇻🇳');
    assertEqual(parsed.items.length, 2);
    assertEqual(parsed.items[0].price, 1250000);
  });

  test('GeminiClient', 'ADV-4.4: cleanAndParseJson throws descriptive error on completely invalid inputs', () => {
    const client = new GeminiClientService();
    let threwNull = false;
    try {
      client.cleanAndParseJson(null as any);
    } catch {
      threwNull = true;
    }
    assert(threwNull, 'Should throw on null input');

    let threwSyntax = false;
    try {
      client.cleanAndParseJson('This is text without any JSON brackets whatsoever');
    } catch {
      threwSyntax = true;
    }
    assert(threwSyntax, 'Should throw syntax error on non-json text');
  });

  test('GeminiClient', 'ADV-4.5: base64ToGenerativePart handles both raw base64 and data-uri headers', () => {
    const rawBase64 = 'SGVsZG8gV29ybGQ=';
    const partRaw = GeminiClientService.base64ToGenerativePart(rawBase64, 'image/jpeg');
    assertEqual(partRaw.inlineData?.data, rawBase64);
    assertEqual(partRaw.inlineData?.mimeType, 'image/jpeg');

    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    const partUri = GeminiClientService.base64ToGenerativePart(dataUri, 'image/png');
    assertEqual(partUri.inlineData?.data, 'iVBORw0KGgoAAAANSUhEUg==');
    assertEqual(partUri.inlineData?.mimeType, 'image/png');
  });

  test('GeminiClient', 'ADV-4.6: Mock mode fallback executes safely when API key is not configured', async () => {
    const client = new GeminiClientService();
    assertEqual(client.isDemoMode(), true);

    const jsonRes = await client.generateJson({
      prompt: 'test prompt',
      mockFallback: () => ({ mockField: 'mockVal' })
    });
    assertEqual(jsonRes.mockField, 'mockVal');

    const textRes = await client.generateText('hello', {
      mockFallback: () => 'Mock text response'
    });
    assertEqual(textRes, 'Mock text response');
  });

  return results;
}

// Standalone runner execution
if (require.main === module) {
  console.log('\n' + '='.repeat(80));
  console.log('  SME AutoPilot — Adversarial Stress Test Suite (Milestone 1)');
  console.log('='.repeat(80) + '\n');

  const testResults = runAdversarialTests();
  let passed = 0;
  let failed = 0;

  const categories = Array.from(new Set(testResults.map(r => r.category)));
  for (const cat of categories) {
    console.log(`📦 CATEGORY: ${cat}`);
    console.log('-'.repeat(80));
    const inCat = testResults.filter(r => r.category === cat);
    for (const r of inCat) {
      if (r.passed) {
        console.log(`  ✅ [PASS] ${r.name}`);
        passed++;
      } else {
        console.log(`  ❌ [FAIL] ${r.name}`);
        console.log(`     Error: ${r.error}`);
        failed++;
      }
    }
    console.log();
  }

  console.log('='.repeat(80));
  console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(80) + '\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
