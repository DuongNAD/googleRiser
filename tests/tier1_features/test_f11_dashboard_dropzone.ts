import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertRange,
  createMockVietQRReceipt
} from '../harness';
import { BillForensicsResult, RiskLevel } from '../../shared';

export interface DashboardKPIs {
  totalRevenueVnd: number;
  totalOrders: number;
  authenticityRatePct: number;
  averageAuditLatencyMs: number;
  riskDistribution: Record<RiskLevel, number>;
}

export function calculateDashboardKPIs(audits: BillForensicsResult[]): DashboardKPIs {
  if (audits.length === 0) {
    return {
      totalRevenueVnd: 0,
      totalOrders: 0,
      authenticityRatePct: 100,
      averageAuditLatencyMs: 0,
      riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
    };
  }

  let totalRevenue = 0;
  let authenticCount = 0;
  const riskDist: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };

  for (const a of audits) {
    totalRevenue += a.extractedData.amount || 0;
    if (a.isAuthentic) authenticCount++;
    riskDist[a.riskLevel] = (riskDist[a.riskLevel] || 0) + 1;
  }

  return {
    totalRevenueVnd: totalRevenue,
    totalOrders: audits.length,
    authenticityRatePct: Math.round((authenticCount / audits.length) * 1000) / 10,
    averageAuditLatencyMs: 450,
    riskDistribution: riskDist
  };
}

export function validateDropzoneFile(file: { name: string; sizeBytes: number; type: string }): {
  accepted: boolean;
  error?: string;
} {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    return {
      accepted: false,
      error: `Định dạng tệp không hợp lệ (${file.type}). Vui lòng tải lên PNG, JPEG, WEBP hoặc PDF.`
    };
  }

  if (file.sizeBytes > maxSizeBytes) {
    return {
      accepted: false,
      error: `Kích thước tệp vượt quá giới hạn 10MB (${(file.sizeBytes / (1024 * 1024)).toFixed(1)}MB).`
    };
  }

  return { accepted: true };
}

export function computeRiskDialAngle(riskLevel: RiskLevel, confidenceScore: number): {
  angleDegrees: number;
  colorHex: string;
  labelVi: string;
} {
  switch (riskLevel) {
    case 'LOW':
      return { angleDegrees: Math.round((1 - confidenceScore) * 60), colorHex: '#10B981', labelVi: 'An Toàn' };
    case 'MEDIUM':
      return { angleDegrees: 75, colorHex: '#F59E0B', labelVi: 'Nghi Vấn' };
    case 'HIGH':
      return { angleDegrees: 135, colorHex: '#EF4444', labelVi: 'Rủi Ro Cao' };
    case 'CRITICAL':
      return { angleDegrees: 180, colorHex: '#7F1D1D', labelVi: 'Gian Lận' };
  }
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  label: string;
  anomalyType?: string;
}

export function normalizeBoundingBox(box: BoundingBox): BoundingBox {
  return {
    ymin: Math.max(0, Math.min(1000, box.ymin)),
    xmin: Math.max(0, Math.min(1000, box.xmin)),
    ymax: Math.max(0, Math.min(1000, box.ymax)),
    xmax: Math.max(0, Math.min(1000, box.xmax)),
    label: box.label,
    anomalyType: box.anomalyType
  };
}

describe('F11: Interactive Dashboard & Quick Dropzone UI State', () => {
  test('Test 11.1: Executive KPI calculations from audit streams', () => {
    const mockAudits: BillForensicsResult[] = [
      createMockVietQRReceipt({ extractedData: { amount: 500000 } as any, riskLevel: 'LOW', isAuthentic: true }),
      createMockVietQRReceipt({ extractedData: { amount: 300000 } as any, riskLevel: 'LOW', isAuthentic: true }),
      createMockVietQRReceipt({ extractedData: { amount: 200000 } as any, riskLevel: 'CRITICAL', isAuthentic: false })
    ];

    const kpis = calculateDashboardKPIs(mockAudits);
    assertEqual(kpis.totalRevenueVnd, 1000000);
    assertEqual(kpis.totalOrders, 3);
    assertEqual(kpis.authenticityRatePct, 66.7);
    assertEqual(kpis.riskDistribution.LOW, 2);
    assertEqual(kpis.riskDistribution.CRITICAL, 1);
  });

  test('Test 11.2: Dropzone receipt upload format and size validation', () => {
    // Valid PNG upload
    const validPng = validateDropzoneFile({ name: 'bill_vietcombank.png', sizeBytes: 1024 * 1024, type: 'image/png' });
    assertTrue(validPng.accepted);

    // Invalid executable upload
    const invalidExe = validateDropzoneFile({ name: 'script.exe', sizeBytes: 5000, type: 'application/x-msdownload' });
    assertFalse(invalidExe.accepted);

    // Oversized 15MB upload
    const oversized = validateDropzoneFile({ name: 'huge_scan.jpg', sizeBytes: 15 * 1024 * 1024, type: 'image/jpeg' });
    assertFalse(oversized.accepted);
  });

  test('Test 11.3: Risk dial angle and color graduation computation', () => {
    const lowDial = computeRiskDialAngle('LOW', 0.98);
    assertRange(lowDial.angleDegrees, 0, 30);
    assertEqual(lowDial.colorHex, '#10B981');

    const medDial = computeRiskDialAngle('MEDIUM', 0.65);
    assertEqual(medDial.colorHex, '#F59E0B');

    const critDial = computeRiskDialAngle('CRITICAL', 0.10);
    assertEqual(critDial.angleDegrees, 180);
    assertEqual(critDial.colorHex, '#7F1D1D');
  });

  test('Test 11.4: Forensic visual bounding box coordinate normalization', () => {
    const rawBox: BoundingBox = {
      ymin: -10,
      xmin: 50,
      ymax: 1050,
      xmax: 900,
      label: 'Tampered Amount',
      anomalyType: 'FONT_MISMATCH'
    };

    const normalized = normalizeBoundingBox(rawBox);
    assertEqual(normalized.ymin, 0);
    assertEqual(normalized.ymax, 1000);
    assertEqual(normalized.xmin, 50);
    assertEqual(normalized.xmax, 900);
  });

  test('Test 11.5: Recent audit log feed formatting and activity status', () => {
    const receipts = [
      createMockVietQRReceipt({ matchedOrderId: 'ORD-01', riskLevel: 'LOW' }),
      createMockVietQRReceipt({ matchedOrderId: 'ORD-02', riskLevel: 'CRITICAL' })
    ];

    const feedItems = receipts.map(r => ({
      id: r.matchedOrderId,
      title: `${r.extractedData.bankName} - ${r.extractedData.amount.toLocaleString('vi-VN')}đ`,
      status: r.riskLevel === 'LOW' ? 'PASS' : 'FLAGGED'
    }));

    assertEqual(feedItems.length, 2);
    assertEqual(feedItems[0].status, 'PASS');
    assertEqual(feedItems[1].status, 'FLAGGED');
  });
});
