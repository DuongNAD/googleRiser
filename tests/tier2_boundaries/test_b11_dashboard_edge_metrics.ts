import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  runAllRegisteredSuites
} from '../harness';
import { BillForensicsResult } from '../../shared';

export interface DashboardMetrics {
  totalRevenueVnd: number;
  totalOrders: number;
  averageOrderValueVnd: number;
  fraudAlertCount: number;
  fraudRiskPercentage: number;
  formattedRevenue: string;
  auditQueueCount: number;
  emptyAuditMessage?: string;
}

export function formatVietnameseCurrency(amountVnd: number): string {
  if (isNaN(amountVnd) || amountVnd === null || amountVnd === undefined) {
    return '0 ₫';
  }

  // Handle extreme billions (tỷ)
  if (amountVnd >= 1_000_000_000) {
    const billions = amountVnd / 1_000_000_000;
    // e.g. 10 tỷ ₫ or formatted as dots 10.000.000.000 ₫
    return `${billions.toLocaleString('vi-VN')} tỷ ₫`;
  }

  return `${amountVnd.toLocaleString('vi-VN')} ₫`;
}

export function calculateDashboardMetrics(
  orders: { totalAmount: number }[],
  audits: BillForensicsResult[]
): DashboardMetrics {
  const totalOrders = orders.length;
  const totalRevenueVnd = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  // Boundary 3: Division by zero in AOV
  const averageOrderValueVnd = totalOrders > 0 ? Math.round(totalRevenueVnd / totalOrders) : 0;

  // Boundary 2: 100% fraudulent surge calculation
  const totalAudits = audits.length;
  const fraudAudits = audits.filter(a => a.riskLevel === 'CRITICAL' || a.riskLevel === 'HIGH');
  const fraudAlertCount = fraudAudits.length;
  const fraudRiskPercentage = totalAudits > 0 ? Math.round((fraudAlertCount / totalAudits) * 100) : 0;

  // Boundary 4: Currency formatting
  const formattedRevenue = formatVietnameseCurrency(totalRevenueVnd);

  // Boundary 5: Empty audit queue
  const pendingAudits = audits.filter(a => a.recommendation === 'MANUAL_REVIEW');
  const emptyAuditMessage = pendingAudits.length === 0 ? 'Không có hóa đơn cần duyệt' : undefined;

  return {
    totalRevenueVnd,
    totalOrders,
    averageOrderValueVnd,
    fraudAlertCount,
    fraudRiskPercentage,
    formattedRevenue,
    auditQueueCount: pendingAudits.length,
    emptyAuditMessage
  };
}

describe('Tier 2 Feature B11: Dashboard Edge Metrics Boundary Tests', () => {
  test('B11.1 - Zero sales day KPI renders zero values without NaN or Infinity errors', () => {
    const metrics = calculateDashboardMetrics([], []);

    assertEqual(metrics.totalOrders, 0);
    assertEqual(metrics.totalRevenueVnd, 0);
    assertEqual(metrics.averageOrderValueVnd, 0);
    assertEqual(metrics.formattedRevenue, '0 ₫');
    assertFalse(isNaN(metrics.averageOrderValueVnd));
  });

  test('B11.2 - 100% fraudulent transaction surge displays 100% risk level correctly', () => {
    const mockAudits: Partial<BillForensicsResult>[] = [
      { riskLevel: 'CRITICAL', recommendation: 'REJECT' },
      { riskLevel: 'CRITICAL', recommendation: 'REJECT' },
      { riskLevel: 'HIGH', recommendation: 'MANUAL_REVIEW' }
    ] as any;

    const metrics = calculateDashboardMetrics([], mockAudits as BillForensicsResult[]);

    assertEqual(metrics.fraudAlertCount, 3);
    assertEqual(metrics.fraudRiskPercentage, 100);
  });

  test('B11.3 - Division by zero in Average Order Value (AOV) is safely guarded to 0 VND', () => {
    const metrics = calculateDashboardMetrics([], []);

    assertEqual(metrics.averageOrderValueVnd, 0);
    assertFalse(Number.isNaN(metrics.averageOrderValueVnd));
    assertTrue(Number.isFinite(metrics.averageOrderValueVnd));
  });

  test('B11.4 - Extreme 10 Billion VND revenue formatting renders correctly in Vietnamese locale', () => {
    const formatted = formatVietnameseCurrency(10_000_000_000);

    assertContains(formatted, '10');
    assertContains(formatted, 'tỷ ₫');

    const formattedNormal = formatVietnameseCurrency(450_000);
    assertContains(formattedNormal, '450.000 ₫');
  });

  test('B11.5 - Empty audit queue displays friendly empty state message', () => {
    const metrics = calculateDashboardMetrics([], []);

    assertEqual(metrics.auditQueueCount, 0);
    assertEqual(metrics.emptyAuditMessage, 'Không có hóa đơn cần duyệt');
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
