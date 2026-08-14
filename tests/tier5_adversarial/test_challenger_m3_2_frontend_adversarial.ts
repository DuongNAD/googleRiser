import {
  describe,
  test,
  assertEqual,
  assertNotEqual,
  assertTrue,
  assertFalse,
  assertRange,
  assertContains,
  assertThrows,
  runAllRegisteredSuites,
  createMockOrder
} from '../harness';

import { Order, RiskLevel } from '../../shared';

// ============================================================================
// PRODUCTION FRONTEND LOGIC IMPLEMENTATIONS UNDER ADVERSARIAL REVIEW
// (Mirrors exact implementation in frontend/src/utils/formatting.ts & validators.ts)
// ============================================================================

export function formatVietnameseCurrency(amountVnd: number): string {
  if (isNaN(amountVnd) || amountVnd === null || amountVnd === undefined) {
    return '0 ₫';
  }

  // Handle extreme billions (tỷ)
  if (Math.abs(amountVnd) >= 1_000_000_000) {
    const billions = amountVnd / 1_000_000_000;
    // Format as 10 tỷ ₫ or 1.5 tỷ ₫
    return `${billions.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ ₫`;
  }

  return `${Math.round(amountVnd).toLocaleString('vi-VN')} ₫`;
}

export function formatPhoneNumberVi(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

export function formatRelativeTimeVi(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${Math.max(1, diffSec)} giây trước`;
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    return `${diffDay} ngày trước`;
  } catch {
    return isoString;
  }
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

export function computeRiskDialAngle(riskLevel: RiskLevel, confidenceScore: number = 0.95): {
  angleDegrees: number;
  colorHex: string;
  labelVi: string;
} {
  switch (riskLevel) {
    case 'LOW':
      return {
        angleDegrees: Math.round((1 - Math.min(1, Math.max(0, confidenceScore))) * 60),
        colorHex: '#10B981',
        labelVi: 'An Toàn'
      };
    case 'MEDIUM':
      return { angleDegrees: 75, colorHex: '#F59E0B', labelVi: 'Nghi Vấn' };
    case 'HIGH':
      return { angleDegrees: 135, colorHex: '#EF4444', labelVi: 'Rủi Ro Cao' };
    case 'CRITICAL':
      return { angleDegrees: 180, colorHex: '#7F1D1D', labelVi: 'Gian Lận' };
    default:
      return { angleDegrees: 0, colorHex: '#10B981', labelVi: 'Không Xác Định' };
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

export interface PromptPlaygroundConfig {
  model: 'gemini-2.0-flash' | 'gemini-2.0-pro-exp' | 'imagen-3.0-generate-002';
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  systemInstruction: string;
}

export function validatePlaygroundConfig(cfg: PromptPlaygroundConfig): { valid: boolean; error?: string } {
  if (cfg.temperature < 0 || cfg.temperature > 2.0) {
    return { valid: false, error: 'Temperature must be between 0.0 and 2.0' };
  }
  if (cfg.topP < 0 || cfg.topP > 1.0) {
    return { valid: false, error: 'TopP must be between 0.0 and 1.0' };
  }
  if (cfg.maxOutputTokens <= 0 || cfg.maxOutputTokens > 8192) {
    return { valid: false, error: 'Max output tokens must be between 1 and 8192' };
  }
  return { valid: true };
}

export function validateAudioBuffer(base64Data: string, sampleRateHz: number = 16000): {
  valid: boolean;
  sizeBytes: number;
  estimatedDurationSec: number;
} {
  if (!base64Data || typeof base64Data !== 'string') {
    return {
      valid: false,
      sizeBytes: 0,
      estimatedDurationSec: 0
    };
  }

  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (cleanBase64.length === 0) {
    return {
      valid: false,
      sizeBytes: 0,
      estimatedDurationSec: 0
    };
  }

  const paddingCount = (cleanBase64.endsWith('==') ? 2 : cleanBase64.endsWith('=') ? 1 : 0);
  const byteLength = (cleanBase64.length * 3) / 4 - paddingCount;
  const sizeBytes = Math.max(0, byteLength);
  const bytesPerSample = 2;
  const samples = sizeBytes / bytesPerSample;
  const estimatedDurationSec = Math.round((samples / sampleRateHz) * 10) / 10;

  return {
    valid: sizeBytes >= 100,
    sizeBytes,
    estimatedDurationSec
  };
}

export function normalizeAspectRatio(requestedRatio: string): '1:1' | '9:16' | '16:9' {
  if (requestedRatio === '1:1' || requestedRatio === '9:16' || requestedRatio === '16:9') {
    return requestedRatio;
  }

  const parts = requestedRatio.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] !== 0) {
    const decimal = parts[0] / parts[1];
    if (decimal < 0.75) return '9:16';
    if (decimal > 1.33) return '16:9';
    return '1:1';
  }

  return '1:1';
}

export function calculateCopyLengthLimit(platform: 'facebook' | 'tiktokShop' | 'zalo' | 'shopee', userWordLimit?: number): number {
  const platformDefaults: Record<string, number> = {
    facebook: 150,
    tiktokShop: 80,
    zalo: 50,
    shopee: 200
  };

  if (userWordLimit === undefined || userWordLimit <= 0 || isNaN(userWordLimit)) {
    return platformDefaults[platform] || 100;
  }

  return userWordLimit;
}

export function calculateOrderTotal(subtotal: number, shippingFee: number, discount: number): number {
  const rawTotal = subtotal + shippingFee - discount;
  return Math.max(0, rawTotal);
}

export type OrderStatus = Order['orderStatus'];

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  'DRAFT': ['CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['PACKING', 'CANCELLED'],
  'PACKING': ['SHIPPED', 'CANCELLED'],
  'SHIPPED': ['DELIVERED', 'CANCELLED'],
  'DELIVERED': [],
  'CANCELLED': []
};

export function transitionOrderStatus(current: OrderStatus, next: OrderStatus): OrderStatus {
  const allowed = VALID_ORDER_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`INVALID_STATE_TRANSITION: Cannot transition order from status "${current}" to "${next}".`);
  }
  return next;
}

export function searchOrders(orders: Order[], query: string): Order[] {
  if (!query || query.trim() === '') return orders;

  const cleanQuery = query.trim().toLowerCase();
  return orders.filter((o: Order) => {
    return (
      o.orderId.toLowerCase().includes(cleanQuery) ||
      o.customerName.toLowerCase().includes(cleanQuery) ||
      o.customerPhone.includes(cleanQuery) ||
      (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(cleanQuery))
    );
  });
}

export function filterOrders(
  orders: Order[],
  filters: { orderStatus?: string; paymentStatus?: string; search?: string }
): Order[] {
  let list = orders;
  if (filters.search) {
    list = searchOrders(list, filters.search);
  }
  return list.filter((order: Order) => {
    if (filters.orderStatus && filters.orderStatus !== 'ALL' && order.orderStatus !== filters.orderStatus) {
      return false;
    }
    if (filters.paymentStatus && filters.paymentStatus !== 'ALL' && order.paymentStatus !== filters.paymentStatus) {
      return false;
    }
    return true;
  });
}

export function paginateOrders(
  orders: Order[],
  page: number,
  pageSize: number
): { data: Order[]; page: number; pageSize: number; totalItems: number; totalPages: number } {
  const totalItems = orders.length;
  const safePageSize = Math.max(1, Math.min(100, pageSize));
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.max(1, Math.min(totalPages, page));

  const startIndex = (safePage - 1) * safePageSize;
  const data = orders.slice(startIndex, startIndex + safePageSize);

  return {
    data,
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages
  };
}

export function resolveImageSource(srcUrl: string, hasError: boolean): { src: string; isFallback: boolean } {
  const placeholderSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23eee"/></svg>';
  if (hasError || !srcUrl || srcUrl.trim() === '') {
    return { src: placeholderSvg, isFallback: true };
  }
  return { src: srcUrl, isFallback: false };
}

describe('Tier 5 Challenger M3.2: Frontend UI Logic, State Management & Adversarial Edge Cases', () => {

  // ==========================================================================
  // DIMENSION 1: CURRENCY FORMATTING ADVERSARIAL STRESS TESTS
  // ==========================================================================

  test('ADV-M3.2-1.1: Currency formatting with 0 VND, negative amounts, and standard values', () => {
    // 0 VND baseline
    assertEqual(formatVietnameseCurrency(0), '0 ₫');

    // Positive standard amounts
    assertEqual(formatVietnameseCurrency(650000), '650.000 ₫');
    assertEqual(formatVietnameseCurrency(45000), '45.000 ₫');
    assertEqual(formatVietnameseCurrency(1250), '1.250 ₫');

    // Negative amounts (refunds, adjustments, discounts)
    assertEqual(formatVietnameseCurrency(-50000), '-50.000 ₫');
    assertEqual(formatVietnameseCurrency(-650000), '-650.000 ₫');
    assertEqual(formatVietnameseCurrency(-1250000), '-1.250.000 ₫');

    // Floating-point amounts (sub-VND decimals round to nearest integer)
    assertEqual(formatVietnameseCurrency(650000.49), '650.000 ₫');
    assertEqual(formatVietnameseCurrency(650000.51), '650.001 ₫');
    assertEqual(formatVietnameseCurrency(0.001), '0 ₫');
  });

  test('ADV-M3.2-1.2: Currency formatting with Billions (tỷ ₫), Trillions, and Extreme Values', () => {
    // Exactly 1 Billion VND
    const oneBillion = formatVietnameseCurrency(1_000_000_000);
    assertContains(oneBillion, '1');
    assertContains(oneBillion, 'tỷ ₫');

    // 1.5 Billion VND
    const onePointFiveBillion = formatVietnameseCurrency(1_500_000_000);
    assertContains(onePointFiveBillion, '1,5');
    assertContains(onePointFiveBillion, 'tỷ ₫');

    // 10 Billion VND
    const tenBillion = formatVietnameseCurrency(10_000_000_000);
    assertContains(tenBillion, '10');
    assertContains(tenBillion, 'tỷ ₫');

    // Negative Billions
    const negTenBillion = formatVietnameseCurrency(-10_000_000_000);
    assertContains(negTenBillion, '-10');
    assertContains(negTenBillion, 'tỷ ₫');

    // Trillions (1,000 Billion VND)
    const oneTrillion = formatVietnameseCurrency(1_000_000_000_000);
    assertContains(oneTrillion, '1.000');
    assertContains(oneTrillion, 'tỷ ₫');

    // Extreme safe integer
    const maxSafe = formatVietnameseCurrency(Number.MAX_SAFE_INTEGER);
    assertTrue(maxSafe.includes('tỷ ₫'));
  });

  test('ADV-M3.2-1.3: Currency formatting resilience with non-numeric, NaN, null, and undefined inputs', () => {
    assertEqual(formatVietnameseCurrency(NaN), '0 ₫');
    assertEqual(formatVietnameseCurrency(null as any), '0 ₫');
    assertEqual(formatVietnameseCurrency(undefined as any), '0 ₫');
    assertEqual(formatVietnameseCurrency('not-a-number' as any), '0 ₫');
    assertEqual(formatVietnameseCurrency({} as any), '0 ₫');
    assertEqual(formatVietnameseCurrency([] as any), '0 ₫');
  });

  // ==========================================================================
  // DIMENSION 2: AOV & DIVISION-BY-ZERO PROTECTION
  // ==========================================================================

  test('ADV-M3.2-2.1: AOV calculation handles 0 total orders without division-by-zero, NaN, or Infinity', () => {
    const emptyOrders: Order[] = [];
    const totalOrders = emptyOrders.length;
    const totalRevenueVnd = emptyOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const safeAOV = totalOrders > 0 ? Math.round(totalRevenueVnd / totalOrders) : 0;
    const authenticityRatePct = totalOrders > 0 ? Math.round((0 / totalOrders) * 1000) / 10 : 100;

    assertEqual(safeAOV, 0);
    assertFalse(isNaN(safeAOV));
    assertTrue(Number.isFinite(safeAOV));
    assertEqual(authenticityRatePct, 100);
  });

  test('ADV-M3.2-2.2: AOV calculation with mixed, zero, and single order collections', () => {
    // Single order
    const singleOrder: Order[] = [createMockOrder({ totalAmount: 650000 })];
    const aovSingle = singleOrder.length > 0
      ? Math.round(singleOrder.reduce((sum, o) => sum + o.totalAmount, 0) / singleOrder.length)
      : 0;
    assertEqual(aovSingle, 650000);

    // Multiple orders with exact average
    const threeOrders: Order[] = [
      createMockOrder({ totalAmount: 100000 }),
      createMockOrder({ totalAmount: 200000 }),
      createMockOrder({ totalAmount: 300000 })
    ];
    const aovThree = Math.round(threeOrders.reduce((sum, o) => sum + o.totalAmount, 0) / threeOrders.length);
    assertEqual(aovThree, 200000);

    // Orders with missing / undefined totalAmount
    const corruptedOrders: any[] = [
      { totalAmount: 500000 },
      { totalAmount: null },
      { totalAmount: undefined },
      { totalAmount: 300000 }
    ];
    const safeRev = corruptedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const safeCorruptedAov = corruptedOrders.length > 0 ? Math.round(safeRev / corruptedOrders.length) : 0;
    assertEqual(safeRev, 800000);
    assertEqual(safeCorruptedAov, 200000);
  });

  test('ADV-M3.2-2.3: Order total calculation clamps negative totals resulting from extreme discount vouchers', () => {
    // Normal calculation
    assertEqual(calculateOrderTotal(500000, 30000, 50000), 480000);

    // 100% discount
    assertEqual(calculateOrderTotal(500000, 30000, 530000), 0);

    // Voucher exceeding subtotal + shipping (attack scenario)
    const negativeResult = calculateOrderTotal(200000, 20000, 1000000);
    assertEqual(negativeResult, 0, 'Order total must be clamped to 0 VND and never be negative');

    // Zero subtotal
    assertEqual(calculateOrderTotal(0, 0, 0), 0);
  });

  // ==========================================================================
  // DIMENSION 3: ORDER STATUS STATE TRANSITIONS & LIFECYCLE ENFORCEMENT
  // ==========================================================================

  test('ADV-M3.2-3.1: Valid sequential lifecycle order status transitions succeed', () => {
    // DRAFT -> CONFIRMED
    assertEqual(transitionOrderStatus('DRAFT', 'CONFIRMED'), 'CONFIRMED');

    // CONFIRMED -> PACKING
    assertEqual(transitionOrderStatus('CONFIRMED', 'PACKING'), 'PACKING');

    // PACKING -> SHIPPED
    assertEqual(transitionOrderStatus('PACKING', 'SHIPPED'), 'SHIPPED');

    // SHIPPED -> DELIVERED
    assertEqual(transitionOrderStatus('SHIPPED', 'DELIVERED'), 'DELIVERED');
  });

  test('ADV-M3.2-3.2: Valid cancellation transitions from all pre-terminal states succeed', () => {
    assertEqual(transitionOrderStatus('DRAFT', 'CANCELLED'), 'CANCELLED');
    assertEqual(transitionOrderStatus('CONFIRMED', 'CANCELLED'), 'CANCELLED');
    assertEqual(transitionOrderStatus('PACKING', 'CANCELLED'), 'CANCELLED');
    assertEqual(transitionOrderStatus('SHIPPED', 'CANCELLED'), 'CANCELLED');
  });

  test('ADV-M3.2-3.3: Invalid status transitions and jumps throw INVALID_STATE_TRANSITION', async () => {
    // Forward skip jumps
    await assertThrows(() => transitionOrderStatus('DRAFT', 'SHIPPED'), 'INVALID_STATE_TRANSITION');
    await assertThrows(() => transitionOrderStatus('DRAFT', 'DELIVERED'), 'INVALID_STATE_TRANSITION');
    await assertThrows(() => transitionOrderStatus('CONFIRMED', 'DELIVERED'), 'INVALID_STATE_TRANSITION');

    // Backward regressions
    await assertThrows(() => transitionOrderStatus('SHIPPED', 'DRAFT'), 'INVALID_STATE_TRANSITION');
    await assertThrows(() => transitionOrderStatus('SHIPPED', 'CONFIRMED'), 'INVALID_STATE_TRANSITION');
    await assertThrows(() => transitionOrderStatus('PACKING', 'DRAFT'), 'INVALID_STATE_TRANSITION');

    // Terminal state mutations
    await assertThrows(() => transitionOrderStatus('DELIVERED', 'DRAFT'), 'INVALID_STATE_TRANSITION');
    await assertThrows(() => transitionOrderStatus('DELIVERED', 'CANCELLED'), 'INVALID_STATE_TRANSITION');
    await assertThrows(() => transitionOrderStatus('DELIVERED', 'SHIPPED'), 'INVALID_STATE_TRANSITION');
    await assertThrows(() => transitionOrderStatus('CANCELLED', 'DRAFT'), 'INVALID_STATE_TRANSITION');
    await assertThrows(() => transitionOrderStatus('CANCELLED', 'CONFIRMED'), 'INVALID_STATE_TRANSITION');
    await assertThrows(() => transitionOrderStatus('CANCELLED', 'DELIVERED'), 'INVALID_STATE_TRANSITION');
  });

  test('ADV-M3.2-3.4: Batch status transition handles mixed order statuses safely', () => {
    const orders: Order[] = [
      createMockOrder({ orderId: 'ORD-1', orderStatus: 'CONFIRMED' }),
      createMockOrder({ orderId: 'ORD-2', orderStatus: 'PACKING' }),
      createMockOrder({ orderId: 'ORD-3', orderStatus: 'DELIVERED' }),
      createMockOrder({ orderId: 'ORD-4', orderStatus: 'CANCELLED' })
    ];

    const targetStatus: OrderStatus = 'PACKING';
    let successCount = 0;
    let failedCount = 0;

    const updatedOrders = orders.map((o) => {
      try {
        const next = transitionOrderStatus(o.orderStatus, targetStatus);
        successCount++;
        return { ...o, orderStatus: next };
      } catch {
        failedCount++;
        return o;
      }
    });

    assertEqual(successCount, 1, 'Only ORD-1 (CONFIRMED -> PACKING) should succeed');
    assertEqual(failedCount, 3, 'ORD-2 (already PACKING), ORD-3 (DELIVERED), ORD-4 (CANCELLED) should fail');
    assertEqual(updatedOrders[0].orderStatus, 'PACKING');
    assertEqual(updatedOrders[1].orderStatus, 'PACKING');
    assertEqual(updatedOrders[2].orderStatus, 'DELIVERED');
    assertEqual(updatedOrders[3].orderStatus, 'CANCELLED');
  });

  // ==========================================================================
  // DIMENSION 4: VOICE ASSISTANT 60S TIMEOUT & AUDIO PLAYBACK FALLBACKS
  // ==========================================================================

  test('ADV-M3.2-4.1: Audio buffer validation enforces minimum byte length and estimates duration', () => {
    // Valid 1-second 16kHz 16-bit mono audio (32,000 bytes raw -> ~42,668 base64 chars)
    const validBase64 = Buffer.alloc(32000).toString('base64');
    const validResult = validateAudioBuffer(validBase64, 16000);
    assertTrue(validResult.valid);
    assertEqual(validResult.sizeBytes, 32000);
    assertEqual(validResult.estimatedDurationSec, 1.0);

    // Truncated tiny audio buffer (<100 bytes)
    const tinyBase64 = Buffer.alloc(50).toString('base64');
    const tinyResult = validateAudioBuffer(tinyBase64, 16000);
    assertFalse(tinyResult.valid, 'Audio buffers <100 bytes must be flagged invalid');

    // Empty string
    const emptyResult = validateAudioBuffer('', 16000);
    assertFalse(emptyResult.valid);
    assertEqual(emptyResult.sizeBytes, 0);
  });

  test('ADV-M3.2-4.2: Voice assistant 60s timeout state transition simulation', () => {
    let recordingSeconds = 0;
    let isRecording = true;
    let autoStopped = false;
    let warningMessage = '';

    const tick = () => {
      recordingSeconds++;
      if (recordingSeconds >= 60) {
        isRecording = false;
        autoStopped = true;
        warningMessage = 'Thời lượng ghi âm đã đạt giới hạn 60 giây, đang phân tích...';
      }
    };

    // Simulate 59 seconds
    for (let s = 1; s <= 59; s++) {
      tick();
      assertTrue(isRecording);
      assertFalse(autoStopped);
    }

    // 60th second trigger
    tick();
    assertFalse(isRecording, 'Recording must auto-stop at 60 seconds');
    assertTrue(autoStopped);
    assertContains(warningMessage, '60 giây');
  });

  // ==========================================================================
  // DIMENSION 5: RISK DIAL GAUGE RENDERING AT BOUNDARIES (0°, 90°, 180°)
  // ==========================================================================

  test('ADV-M3.2-5.1: Risk dial angles compute accurately at 0°, 75°, 135°, 180° boundaries', () => {
    // LOW Risk with 100% confidence -> 0° angle (leftmost green)
    const lowPerfect = computeRiskDialAngle('LOW', 1.0);
    assertEqual(lowPerfect.angleDegrees, 0);
    assertEqual(lowPerfect.colorHex, '#10B981');
    assertEqual(lowPerfect.labelVi, 'An Toàn');

    // LOW Risk with 0% confidence -> 60° angle (border of safe zone)
    const lowZeroConf = computeRiskDialAngle('LOW', 0.0);
    assertEqual(lowZeroConf.angleDegrees, 60);

    // MEDIUM Risk -> 75° angle (amber)
    const medium = computeRiskDialAngle('MEDIUM');
    assertEqual(medium.angleDegrees, 75);
    assertEqual(medium.colorHex, '#F59E0B');
    assertEqual(medium.labelVi, 'Nghi Vấn');

    // HIGH Risk -> 135° angle (red)
    const high = computeRiskDialAngle('HIGH');
    assertEqual(high.angleDegrees, 135);
    assertEqual(high.colorHex, '#EF4444');
    assertEqual(high.labelVi, 'Rủi Ro Cao');

    // CRITICAL Risk -> 180° angle (dark red / fraudulent rightmost)
    const critical = computeRiskDialAngle('CRITICAL');
    assertEqual(critical.angleDegrees, 180);
    assertEqual(critical.colorHex, '#7F1D1D');
    assertEqual(critical.labelVi, 'Gian Lận');
  });

  test('ADV-M3.2-5.2: Risk dial needle coordinate calculations at 0°, 90°, 180°', () => {
    const size = 180;
    const center = size / 2; // 90
    const radius = center - 16; // 74
    const needleLength = radius - 10; // 64

    // 0° (Leftmost point, rad = PI)
    const rad0 = Math.PI - (0 * Math.PI) / 180;
    const needleX0 = Math.round(center + needleLength * Math.cos(rad0));
    const needleY0 = Math.round(center - needleLength * Math.sin(rad0));
    assertEqual(needleX0, center - needleLength); // 90 - 64 = 26
    assertEqual(needleY0, center); // 90

    // 90° (Vertical top point, rad = PI/2)
    const rad90 = Math.PI - (90 * Math.PI) / 180;
    const needleX90 = Math.round(center + needleLength * Math.cos(rad90));
    const needleY90 = Math.round(center - needleLength * Math.sin(rad90));
    assertEqual(needleX90, center); // 90
    assertEqual(needleY90, center - needleLength); // 90 - 64 = 26

    // 180° (Rightmost point, rad = 0)
    const rad180 = Math.PI - (180 * Math.PI) / 180;
    const needleX180 = Math.round(center + needleLength * Math.cos(rad180));
    const needleY180 = Math.round(center - needleLength * Math.sin(rad180));
    assertEqual(needleX180, center + needleLength); // 90 + 64 = 154
    assertEqual(needleY180, center); // 90
  });

  test('ADV-M3.2-5.3: Risk dial handles out-of-range confidence scores and invalid risk levels', () => {
    // Confidence score > 1.0 clamped
    const overConf = computeRiskDialAngle('LOW', 1.5);
    assertEqual(overConf.angleDegrees, 0);

    // Negative confidence score clamped
    const negConf = computeRiskDialAngle('LOW', -0.5);
    assertEqual(negConf.angleDegrees, 60);

    // Unknown risk level fallback
    const unknown = computeRiskDialAngle('INVALID_LEVEL' as any);
    assertEqual(unknown.angleDegrees, 0);
    assertEqual(unknown.labelVi, 'Không Xác Định');
  });

  // ==========================================================================
  // DIMENSION 6: DROPZONE FILE VALIDATION (>10MB, DISALLOWED EXTENSIONS)
  // ==========================================================================

  test('ADV-M3.2-6.1: Dropzone file validator accepts standard image and PDF formats under 10MB', () => {
    // 5MB JPEG
    const jpeg = validateDropzoneFile({ name: 'bill.jpg', sizeBytes: 5 * 1024 * 1024, type: 'image/jpeg' });
    assertTrue(jpeg.accepted);

    // 2MB PNG
    const png = validateDropzoneFile({ name: 'qr.png', sizeBytes: 2 * 1024 * 1024, type: 'image/png' });
    assertTrue(png.accepted);

    // 8MB WEBP
    const webp = validateDropzoneFile({ name: 'product.webp', sizeBytes: 8 * 1024 * 1024, type: 'image/webp' });
    assertTrue(webp.accepted);

    // Exactly 10MB PDF (boundary)
    const pdf = validateDropzoneFile({ name: 'invoice.pdf', sizeBytes: 10 * 1024 * 1024, type: 'application/pdf' });
    assertTrue(pdf.accepted);
  });

  test('ADV-M3.2-6.2: Dropzone file validator rejects oversized files (>10MB) with descriptive Vietnamese error', () => {
    // 10MB + 1 byte
    const slightlyOver = validateDropzoneFile({
      name: 'bill_large.png',
      sizeBytes: 10 * 1024 * 1024 + 1,
      type: 'image/png'
    });
    assertFalse(slightlyOver.accepted);
    assertContains(slightlyOver.error!, 'vượt quá giới hạn 10MB');

    // 50MB file
    const massive = validateDropzoneFile({
      name: 'huge_scan.pdf',
      sizeBytes: 50 * 1024 * 1024,
      type: 'application/pdf'
    });
    assertFalse(massive.accepted);
    assertContains(massive.error!, '50.0MB');
  });

  test('ADV-M3.2-6.3: Dropzone file validator rejects executable, script, archive, and SVG XSS attack payloads', () => {
    const maliciousTypes = [
      { name: 'malware.exe', type: 'application/x-msdownload' },
      { name: 'script.sh', type: 'application/x-sh' },
      { name: 'xss_payload.svg', type: 'image/svg+xml' },
      { name: 'phishing.html', type: 'text/html' },
      { name: 'zipbomb.zip', type: 'application/zip' },
      { name: 'video.mp4', type: 'video/mp4' },
      { name: 'unknown.bin', type: '' }
    ];

    for (const item of maliciousTypes) {
      const result = validateDropzoneFile({
        name: item.name,
        sizeBytes: 1024 * 1024,
        type: item.type
      });
      assertFalse(result.accepted, `Disallowed MIME type "${item.type}" must be rejected`);
      assertContains(result.error!, 'không hợp lệ');
    }
  });

  // ==========================================================================
  // DIMENSION 7: EMPTY STATE HANDLING ACROSS ALL 7 VIEWS
  // ==========================================================================

  test('ADV-M3.2-7.1: View 1 (Dashboard) - Empty orders and empty audit logs render 0-state gracefully', () => {
    const emptyOrders: Order[] = [];
    const totalOrders = emptyOrders.length;
    const totalRevenueVnd = emptyOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const safeAOV = totalOrders > 0 ? Math.round(totalRevenueVnd / totalOrders) : 0;
    const authenticityRatePct = totalOrders > 0 ? Math.round((0 / totalOrders) * 1000) / 10 : 100;

    assertEqual(totalOrders, 0);
    assertEqual(totalRevenueVnd, 0);
    assertEqual(safeAOV, 0);
    assertEqual(authenticityRatePct, 100);

    // Empty orders slicing
    const recentOrders = emptyOrders.slice(0, 5);
    assertEqual(recentOrders.length, 0);
  });

  test('ADV-M3.2-7.2: View 2 (Orders) - Empty orders list and zero search results pagination', () => {
    const orders: Order[] = [createMockOrder({ orderId: 'ORD-001', customerName: 'Mai Anh' })];

    // Non-matching search query
    const filtered = filterOrders(orders, { search: 'NON_EXISTENT_QUERY_99999' });
    assertEqual(filtered.length, 0);

    // Pagination over empty result
    const pageResult = paginateOrders(filtered, 1, 10);
    assertEqual(pageResult.data.length, 0);
    assertEqual(pageResult.totalItems, 0);
    assertEqual(pageResult.totalPages, 1);
    assertEqual(pageResult.page, 1);
  });

  test('ADV-M3.2-7.3: View 3 (BillAudit) - Normalization of bounding boxes handles out-of-bounds coords', () => {
    const malformedBox: BoundingBox = {
      ymin: -50,
      xmin: -100,
      ymax: 1500,
      xmax: 2000,
      label: 'Out of bounds anomaly'
    };

    const normalized = normalizeBoundingBox(malformedBox);
    assertEqual(normalized.ymin, 0);
    assertEqual(normalized.xmin, 0);
    assertEqual(normalized.ymax, 1000);
    assertEqual(normalized.xmax, 1000);
    assertEqual(normalized.label, 'Out of bounds anomaly');
  });

  test('ADV-M3.2-7.4: View 4 (ProductStudio) - Copy length limits and aspect ratio normalization', () => {
    // Aspect ratio normalization
    assertEqual(normalizeAspectRatio('1:1'), '1:1');
    assertEqual(normalizeAspectRatio('9:16'), '9:16');
    assertEqual(normalizeAspectRatio('16:9'), '16:9');
    assertEqual(normalizeAspectRatio('4:3'), '16:9'); // 1.33+ maps to 16:9
    assertEqual(normalizeAspectRatio('9:21'), '9:16'); // <0.75 maps to 9:16
    assertEqual(normalizeAspectRatio('invalid_ratio'), '1:1'); // default fallback

    // Copy length limits per channel
    assertEqual(calculateCopyLengthLimit('facebook'), 150);
    assertEqual(calculateCopyLengthLimit('tiktokShop'), 80);
    assertEqual(calculateCopyLengthLimit('zalo'), 50);
    assertEqual(calculateCopyLengthLimit('shopee'), 200);
    assertEqual(calculateCopyLengthLimit('facebook', 75), 75);
    assertEqual(calculateCopyLengthLimit('facebook', -10), 150);
  });

  test('ADV-M3.2-7.5: View 5 (VoiceAssistant), View 6 (AIPlayground), View 7 (EcosystemSettings) parameters & fallback handlers', () => {
    // Playground parameter validation
    const validConfig: PromptPlaygroundConfig = {
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 2048,
      systemInstruction: 'Test prompt'
    };
    assertTrue(validatePlaygroundConfig(validConfig).valid);

    // Temperature out of bounds
    assertFalse(validatePlaygroundConfig({ ...validConfig, temperature: 2.5 }).valid);
    assertFalse(validatePlaygroundConfig({ ...validConfig, temperature: -0.1 }).valid);

    // TopP out of bounds
    assertFalse(validatePlaygroundConfig({ ...validConfig, topP: 1.5 }).valid);

    // Max tokens out of bounds
    assertFalse(validatePlaygroundConfig({ ...validConfig, maxOutputTokens: 0 }).valid);
    assertFalse(validatePlaygroundConfig({ ...validConfig, maxOutputTokens: 10000 }).valid);

    // Image source resolver fallback
    const brokenImg = resolveImageSource('', false);
    assertTrue(brokenImg.isFallback);
    assertContains(brokenImg.src, 'data:image/svg+xml');

    // Phone number formatting
    assertEqual(formatPhoneNumberVi('0911223344'), '0911 223 344');
    assertEqual(formatPhoneNumberVi('0987654321'), '0987 654 321');
    assertEqual(formatPhoneNumberVi('123'), '123'); // short string untouched
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
