/**
 * Milestone 1 Unit Tests: VietQR & 25+ Bank Transfer Slip Forensics Engine
 * backend/tests/ai/billForensics.test.ts
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

export function runBillForensicsTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message || String(err) });
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

  // 1. Bank Registry Verification
  test('BillForensics: 25+ Vietnamese banks and e-wallets are registered', () => {
    const bankCount = Object.keys(VIETNAMESE_BANKS).length;
    assert(bankCount >= 25, `Expected >= 25 banks, found ${bankCount}`);
    assert(lookupBankInfo('970436')?.shortName === 'VCB', 'Vietcombank BIN match');
    assert(lookupBankInfo('MB')?.bin === '970422', 'MBBank short code match');
    assert(lookupBankInfo('Techcombank')?.bin === '970407', 'Techcombank full name match');
    assert(lookupBankInfo('MoMo')?.bin === '971005', 'MoMo e-wallet match');
    assert(lookupBankInfo('ZaloPay')?.bin === '971007', 'ZaloPay e-wallet match');
    assert(lookupBankInfo('ViettelMoney')?.bin === '971001', 'Viettel Money match');
    assert(lookupBankInfo('CAKE')?.bin === '546034', 'CAKE by VPBank match');
    assert(lookupBankInfo('Timo')?.bin === '963388', 'Timo digital bank match');
  });

  // 2. VietQR EMVCo CRC16 & TLV Engine
  test('BillForensics: VietQR CRC16 calculation and validation', () => {
    const qrPayload = buildVietQRPayload({
      bankBin: '970436',
      accountNumber: '1012345678',
      amount: 589000,
      transferContent: 'THANH TOAN ORD-001'
    });

    const parsed = parseVietQRPayload(qrPayload);
    assert(parsed.isValidCrc, 'Built VietQR payload should have valid CRC16');
    assertEqual(parsed.bankBin, '970436');
    assertEqual(parsed.accountNumber, '1012345678');
    assertEqual(parsed.amount, 589000);
    assertEqual(parsed.transferContent, 'THANH TOAN ORD-001');
    assertEqual(parsed.guid, 'A000000727');
  });

  test('BillForensics: Tampered VietQR payload is caught by CRC16 check', () => {
    const validQr = buildVietQRPayload({
      bankBin: '970422',
      accountNumber: '0912345678',
      amount: 100000
    });

    // Tamper the amount in the payload string without updating CRC
    const tamperedQr = validQr.replace('100000', '999999');
    const parsed = parseVietQRPayload(tamperedQr);
    assert(!parsed.isValidCrc, 'Tampered QR must fail CRC validation');
  });

  // 3. 5-Layer Digital Forensics Matrix
  test('BillForensics: Layer 1 flags Clock Paradox (status bar time < transfer time)', () => {
    const evaluation = evaluate5LayerForensics({
      statusBarTime: '08:15',
      transactionTime: '09:30',
      extractedTxId: 'TX123456',
      extractedAmount: 500000
    });

    assert(evaluation.forensicLayers.layer1_clockConsistency.isClockParadox, 'Should detect clock paradox');
    assertEqual(evaluation.riskLevel, 'CRITICAL');
    assert(evaluation.score <= 65, 'Should apply 35pt penalty for clock paradox');
    assert(evaluation.anomalies.some(a => a.type === 'CLOCK_PARADOX'));
  });

  test('BillForensics: Layer 2 flags Typography and Kerning anomalies', () => {
    const evaluation = evaluate5LayerForensics({
      statusBarTime: '10:00',
      transactionTime: '09:58',
      fontAnomalyDetected: true,
      extractedTxId: 'TX123456',
      extractedAmount: 500000
    });

    assert(!evaluation.forensicSignals.fontConsistency, 'Font consistency should be false');
    assert(evaluation.riskLevel === 'HIGH' || evaluation.riskLevel === 'CRITICAL');
    assert(evaluation.score <= 65, 'Should apply 35pt penalty for font anomaly');
  });

  test('BillForensics: Layer 3 flags Compression & ELA DCT halos', () => {
    const evaluation = evaluate5LayerForensics({
      statusBarTime: '10:00',
      transactionTime: '09:58',
      compressionHaloDetected: true,
      extractedTxId: 'TX123456',
      extractedAmount: 500000
    });

    assert(!evaluation.forensicSignals.compressionArtifacts);
    assertEqual(evaluation.riskLevel, 'MEDIUM');
    assert(evaluation.score === 80, 'Should apply 20pt penalty for ELA halo');
  });

  test('BillForensics: Layer 4 flags Bank Logo Distortion', () => {
    const evaluation = evaluate5LayerForensics({
      statusBarTime: '10:00',
      transactionTime: '09:58',
      logoDistortionDetected: true,
      identifiedBank: 'Techcombank',
      extractedTxId: 'TX123456',
      extractedAmount: 500000
    });

    assert(!evaluation.forensicSignals.logoAuthenticity);
    assertEqual(evaluation.riskLevel, 'MEDIUM');
    assert(evaluation.score === 75, 'Should apply 25pt penalty for logo distortion');
  });

  test('BillForensics: Layer 5 flags VietQR data mismatch with receipt text', () => {
    const qrPayload = buildVietQRPayload({
      bankBin: '970436',
      accountNumber: '9999999999', // Different account
      amount: 589000
    });

    const evaluation = evaluate5LayerForensics({
      statusBarTime: '10:00',
      transactionTime: '09:58',
      qrPayload,
      extractedAccount: '1111111111', // Receipt shows 1111111111
      extractedAmount: 589000,
      extractedTxId: 'TX123456'
    });

    assert(!evaluation.forensicSignals.qrIntegrity);
    assert(evaluation.anomalies.some(a => a.type === 'QR_DATA_MISMATCH'));
  });

  test('BillForensics: Genuine receipt scores >= 85 and achieves LOW risk and AUTO_APPROVE', () => {
    const qrPayload = buildVietQRPayload({
      bankBin: '970436',
      accountNumber: '1012345678',
      amount: 589000,
      transferContent: 'ORD-VN-20260814-001'
    });

    const service = new BillForensicsService();
    const result = service.auditWithHeuristicEngine({
      receiptData: {
        bankName: 'VCB',
        accountNumber: '1012345678',
        amount: 589000,
        transactionTime: '14:30',
        transactionId: 'FT20260814001',
        transferContent: 'ORD-VN-20260814-001'
      },
      rawQrPayload: qrPayload,
      activeOrders: [
        {
          orderId: 'ORD-VN-20260814-001',
          totalAmount: 589000,
          customerPhone: '0912345678'
        }
      ]
    });

    assertEqual(result.riskLevel, 'LOW');
    assertEqual(result.isAuthentic, true);
    assert(result.confidenceScore >= 0.85);
    assertEqual(result.reconciliationStatus, 'MATCHED');
    assertEqual(result.recommendation, 'AUTO_APPROVE');
    assertEqual(result.matchedOrderId, 'ORD-VN-20260814-001');
  });

  // 4. Auto-Reconciliation Edge Cases
  test('BillForensics: Auto-reconciliation rejects high-risk transfers immediately', () => {
    const forgedForensics: any = {
      riskLevel: 'CRITICAL',
      extractedData: {
        amount: 589000,
        transferContent: 'ORD-VN-20260814-001'
      }
    };

    const rec = reconcileWithOrders(forgedForensics, [
      { orderId: 'ORD-VN-20260814-001', totalAmount: 589000 }
    ]);

    assertEqual(rec.reconciliationStatus, 'FLAGGED');
    assertEqual(rec.recommendation, 'REJECT');
  });

  test('BillForensics: Amount mismatch between receipt and order flags for manual review', () => {
    const validForensics: any = {
      riskLevel: 'LOW',
      extractedData: {
        amount: 500000, // Receipt amount is 500k, order is 589k
        transferContent: 'ORD-VN-20260814-001'
      }
    };

    const rec = reconcileWithOrders(validForensics, [
      { orderId: 'ORD-VN-20260814-001', totalAmount: 589000 }
    ]);

    assertEqual(rec.reconciliationStatus, 'FLAGGED');
    assertEqual(rec.recommendation, 'MANUAL_REVIEW');
  });

  return results;
}
