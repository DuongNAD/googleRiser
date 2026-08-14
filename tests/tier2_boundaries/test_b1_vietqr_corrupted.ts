import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertRange,
  assertContains,
  assertThrows,
  runAllRegisteredSuites,
  createMockVietQRReceipt,
  generateVietQRPayload
} from '../harness';
import { BillForensicsResult, RiskLevel, Recommendation } from '../../shared';

// Domain logic under test for receipt validation and forensics edge cases
export function auditReceiptBoundary(receipt: BillForensicsResult): BillForensicsResult {
  const anomalies: string[] = [...receipt.forensicSignals.anomalies];
  let isAuthentic = receipt.isAuthentic;
  let riskLevel: RiskLevel = receipt.riskLevel;
  let recommendation: Recommendation = receipt.recommendation;
  let confidenceScore = receipt.confidenceScore;
  let reconciliationStatus = receipt.reconciliationStatus;

  // Boundary 1: Corrupted or unreadable raw OCR text
  if (!receipt.rawOcrText || receipt.rawOcrText.trim().length < 10) {
    anomalies.push('IMAGE_CORRUPTED_OR_UNREADABLE');
    isAuthentic = false;
    confidenceScore = Math.min(confidenceScore, 0.2);
    riskLevel = 'CRITICAL';
    recommendation = 'REJECT';
    reconciliationStatus = 'FLAGGED';
  }

  // Boundary 2: 0 VND transfer
  if (receipt.extractedData.amount <= 0) {
    anomalies.push('INVALID_TRANSFER_AMOUNT_ZERO_OR_NEGATIVE');
    isAuthentic = false;
    riskLevel = 'CRITICAL';
    recommendation = 'REJECT';
    reconciliationStatus = 'FLAGGED';
  }

  // Boundary 3: Missing transaction ID
  if (!receipt.extractedData.transactionId || receipt.extractedData.transactionId.trim() === '') {
    anomalies.push('MISSING_TRANSACTION_REF');
    isAuthentic = false;
    if (riskLevel === 'LOW') riskLevel = 'HIGH';
    recommendation = 'MANUAL_REVIEW';
    reconciliationStatus = 'UNMATCHED';
  }

  // Boundary 4: 100M VND limit overflow (High value transaction check)
  const HIGH_VALUE_THRESHOLD = 100000000; // 100M VND
  if (receipt.extractedData.amount > HIGH_VALUE_THRESHOLD) {
    anomalies.push('HIGH_VALUE_THRESHOLD_EXCEEDED');
    if (riskLevel === 'LOW') riskLevel = 'HIGH';
    recommendation = 'MANUAL_REVIEW';
  }

  // Boundary 5: Mismatched status bar clock vs transfer timestamp
  if (receipt.forensicSignals.timestampMatch === false) {
    anomalies.push('TIMESTAMP_DESYNCHRONIZATION_DETECTED');
    isAuthentic = false;
    riskLevel = 'CRITICAL';
    recommendation = 'REJECT';
    reconciliationStatus = 'FLAGGED';
  }

  return {
    ...receipt,
    isAuthentic,
    confidenceScore,
    riskLevel,
    recommendation,
    reconciliationStatus,
    forensicSignals: {
      ...receipt.forensicSignals,
      anomalies
    }
  };
}

describe('Tier 2 Feature B1: VietQR & Forensics Boundary Tests', () => {
  test('B1.1 - Corrupted or unreadable receipt image triggers CRITICAL risk and REJECT recommendation', () => {
    const corruptedReceipt = createMockVietQRReceipt({
      rawOcrText: '',
      confidenceScore: 0.15
    });

    const result = auditReceiptBoundary(corruptedReceipt);

    assertFalse(result.isAuthentic, 'Corrupted receipt must not be marked authentic');
    assertEqual(result.riskLevel, 'CRITICAL', 'Risk level must be CRITICAL');
    assertEqual(result.recommendation, 'REJECT', 'Recommendation must be REJECT');
    assertRange(result.confidenceScore, 0, 0.3, 'Confidence score must be <= 0.3');
    assertContains(result.forensicSignals.anomalies, 'IMAGE_CORRUPTED_OR_UNREADABLE');
  });

  test('B1.2 - 0 VND transfer amount is rejected as invalid transaction amount', () => {
    const zeroAmountReceipt = createMockVietQRReceipt({
      extractedData: {
        bankName: 'Vietcombank',
        accountNumber: '1029384756',
        accountHolder: 'NGUYEN VAN AN',
        amount: 0,
        currency: 'VND',
        transactionId: 'FT24081400000000',
        transactionTime: '2026-08-14 10:25:30',
        transferContent: 'Zero VND test'
      }
    });

    const result = auditReceiptBoundary(zeroAmountReceipt);

    assertEqual(result.extractedData.amount, 0);
    assertEqual(result.riskLevel, 'CRITICAL');
    assertEqual(result.recommendation, 'REJECT');
    assertContains(result.forensicSignals.anomalies, 'INVALID_TRANSFER_AMOUNT_ZERO_OR_NEGATIVE');
  });

  test('B1.3 - Missing transaction ID flags UNMATCHED status and escalates to MANUAL_REVIEW', () => {
    const missingTxReceipt = createMockVietQRReceipt({
      extractedData: {
        bankName: 'Techcombank',
        accountNumber: '19034567890123',
        accountHolder: 'TRAN THI MAI',
        amount: 350000,
        currency: 'VND',
        transactionId: '',
        transactionTime: '2026-08-14 11:00:00',
        transferContent: 'Ao Dai size M'
      }
    });

    const result = auditReceiptBoundary(missingTxReceipt);

    assertEqual(result.reconciliationStatus, 'UNMATCHED');
    assertEqual(result.recommendation, 'MANUAL_REVIEW');
    assertContains(result.forensicSignals.anomalies, 'MISSING_TRANSACTION_REF');
  });

  test('B1.4 - 100M VND transaction limit overflow escalates risk to HIGH and requires MANUAL_REVIEW', () => {
    const highValueReceipt = createMockVietQRReceipt({
      extractedData: {
        bankName: 'MBBank',
        accountNumber: '0000123456789',
        accountHolder: 'LE VAN CUONG',
        amount: 150000000, // 150 Million VND (> 100M limit)
        currency: 'VND',
        transactionId: 'MB240814999999',
        transactionTime: '2026-08-14 11:30:00',
        transferContent: 'Thanh toan don hang si so luong lon'
      }
    });

    const result = auditReceiptBoundary(highValueReceipt);

    assertEqual(result.riskLevel, 'HIGH');
    assertEqual(result.recommendation, 'MANUAL_REVIEW');
    assertContains(result.forensicSignals.anomalies, 'HIGH_VALUE_THRESHOLD_EXCEEDED');
  });

  test('B1.5 - Mismatched status bar clock vs transfer timestamp flags CRITICAL timestamp anomaly', () => {
    const desyncedReceipt = createMockVietQRReceipt({
      forensicSignals: {
        timestampMatch: false,
        fontConsistency: true,
        compressionArtifacts: false,
        logoAuthenticity: true,
        qrIntegrity: true,
        anomalies: []
      }
    });

    const result = auditReceiptBoundary(desyncedReceipt);

    assertFalse(result.forensicSignals.timestampMatch);
    assertFalse(result.isAuthentic);
    assertEqual(result.riskLevel, 'CRITICAL');
    assertEqual(result.recommendation, 'REJECT');
    assertContains(result.forensicSignals.anomalies, 'TIMESTAMP_DESYNCHRONIZATION_DETECTED');
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
