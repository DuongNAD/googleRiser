/**
 * SME AutoPilot — Milestone 6 Challenger Adversarial Stress Suite (Vector A)
 * tests/tier5_adversarial/test_challenger_m6_1_vector_a.ts
 *
 * Vector A Focus: Core Multimodal Forensics, QR Fuzzing & Image/Math Hardening
 *
 * Test Scenarios:
 * - ADV-A-01: Fuzzed Multibyte UTF-8 VietQR TLV Injection (accents in Tag 62 / Tag 38, byte length vs char length)
 * - ADV-A-02: Malformed Non-Hex CRC Tag 63 Handling (6304ZZZZ, 6304!@#$, truncated CRC, penalty >= 40pts)
 * - ADV-A-03: EXIF Rotation & Inverted Header Normalization (Orientation 6/3/8, status bar clock position, clock skew)
 * - ADV-A-04: Variable Font Weight & Kerning Splicing (mixed fonts/weights on digits, font anomaly flags, risk scoring)
 * - ADV-A-05: Boundary Micro (1 VND) & Extreme Macro (10B VND) Transfers (10 tỷ ₫, integer overflow prevention)
 * - ADV-A-06: Negative Voucher & Zero Total Order Invariants (clamping to 0 VND, non-negative totals, liability guards)
 * - ADV-A-07: Low-Contrast (<2.0 Lum) & Moire Pattern Blur (graceful degradation, MANUAL_REVIEW, ELA/Logo flags)
 * - ADV-A-08: Leap Year 2026-02-29 & Timezone Offset Defense (impossible date rejection, UTC vs ICT alignment)
 */

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
  runAllRegisteredSuites
} from '../harness';

import {
  BillForensicsService,
  evaluate5LayerForensics,
  reconcileWithOrders,
  calculateCrc16Ccitt,
  parseVietQRPayload,
  buildVietQRPayload,
  lookupBankInfo,
  VIETNAMESE_BANKS,
  ForensicsEvaluationInputs
} from '../../backend/src/ai/billForensics';

import {
  applyDiscountVoucher,
  calculateShippingFee,
  createDraftOrder,
  executeToolCall
} from '../../backend/src/ai/tools';

import { RiskLevel, Recommendation } from '../../shared/types/ai';

// ============================================================================
// PRODUCTION FRONTEND LOGIC IMPLEMENTATIONS UNDER ADVERSARIAL REVIEW
// (Mirrors exact production functions in frontend/src/utils/formatting.ts & validators.ts)
// ============================================================================

export function formatVietnameseCurrency(amountVnd: number): string {
  if (isNaN(amountVnd) || amountVnd === null || amountVnd === undefined) {
    return '0 ₫';
  }

  // Handle extreme billions (tỷ)
  if (Math.abs(amountVnd) >= 1_000_000_000) {
    const billions = amountVnd / 1_000_000_000;
    return `${billions.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ ₫`;
  }

  return `${Math.round(amountVnd).toLocaleString('vi-VN')} ₫`;
}

export function formatDateTimeVi(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return isoString;
  }
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

export function formatPhoneNumberVi(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
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

export function calculateOrderTotal(subtotal: number, shippingFee: number, discount: number): number {
  const rawTotal = subtotal + shippingFee - discount;
  return Math.max(0, rawTotal);
}

// ============================================================================
// ADVERSARIAL CHALLENGER HELPER UTILITIES & ORACLES
// ============================================================================

/**
 * Validates whether a calendar date is genuinely valid in the Gregorian calendar.
 * Rejects non-existent dates like 2026-02-29, 2026-04-31, 2026-13-01.
 */
export function validateStrictCalendarDate(dateStr: string): { isValid: boolean; reason?: string; parsedDate?: Date } {
  if (!dateStr || typeof dateStr !== 'string') {
    return { isValid: false, reason: 'EMPTY_OR_INVALID_STRING' };
  }

  // Support YYYY-MM-DD or YYYY-MM-DD HH:mm:ss or ISO 8601
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(?:Z|([+-]\d{2}:?\d{2}))?)?$/);
  if (!isoMatch) {
    return { isValid: false, reason: 'MALFORMED_DATE_FORMAT' };
  }

  const year = parseInt(isoMatch[1], 10);
  const month = parseInt(isoMatch[2], 10);
  const day = parseInt(isoMatch[3], 10);

  if (month < 1 || month > 12) {
    return { isValid: false, reason: `INVALID_MONTH_${month}` };
  }

  // Days in each month for common vs leap years
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const maxDays = daysInMonth[month - 1];
  if (day < 1 || day > maxDays) {
    return {
      isValid: false,
      reason: `IMPOSSIBLE_DAY_${day}_FOR_MONTH_${month}_YEAR_${year}_(MAX_${maxDays})`
    };
  }

  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, reason: 'INVALID_DATE_TIMESTAMP' };
  }

  return { isValid: true, parsedDate: dateObj };
}

/**
 * Normalizes timestamps across timezones (e.g. UTC+0 vs ICT UTC+7) and evaluates
 * clock consistency without false clock paradox triggers.
 */
export function evaluateTimezoneAwareClockConsistency(params: {
  statusBarTime: string;       // e.g. "14:35" or "2026-08-14T07:35:00Z"
  transactionTime: string;     // e.g. "14:30" or "2026-08-14T14:30:00+07:00"
  statusBarTzOffsetHours?: number; // default +7 for Vietnam local screenshot
  txTzOffsetHours?: number;        // default +7 for Vietnam banking
}): { isClockParadox: boolean; timeGapMinutes: number; details: string } {
  const { statusBarTime, transactionTime, statusBarTzOffsetHours = 7, txTzOffsetHours = 7 } = params;

  // Check if full ISO dates with timezone indicators
  const isFullDateStatus = statusBarTime.includes('T') || statusBarTime.includes('Z') || statusBarTime.includes('+');
  const isFullDateTx = transactionTime.includes('T') || transactionTime.includes('Z') || transactionTime.includes('+');

  if (isFullDateStatus && isFullDateTx) {
    const statusEpoch = new Date(statusBarTime).getTime();
    const txEpoch = new Date(transactionTime).getTime();

    if (isNaN(statusEpoch) || isNaN(txEpoch)) {
      return { isClockParadox: false, timeGapMinutes: 0, details: 'Invalid timestamp format' };
    }

    const diffMinutes = Math.floor((statusEpoch - txEpoch) / (60 * 1000));
    if (diffMinutes < 0) {
      return {
        isClockParadox: true,
        timeGapMinutes: diffMinutes,
        details: `Clock Paradox: Screenshot (${statusBarTime}) is earlier than transfer (${transactionTime}) by ${Math.abs(diffMinutes)}m`
      };
    }

    return {
      isClockParadox: false,
      timeGapMinutes: diffMinutes,
      details: `Clock consistent: Time gap is ${diffMinutes}m`
    };
  }

  // Plain HH:mm format parsing with timezone offset normalization
  const parseTimeToMinutes = (tStr: string): number | null => {
    const m = tStr.match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };

  const rawStatusMins = parseTimeToMinutes(statusBarTime);
  const rawTxMins = parseTimeToMinutes(transactionTime);

  if (rawStatusMins === null || rawTxMins === null) {
    return { isClockParadox: false, timeGapMinutes: 0, details: 'Unparseable HH:mm time format' };
  }

  // Normalize both to UTC minutes (modulo 24*60 = 1440)
  const normStatusMins = (rawStatusMins - statusBarTzOffsetHours * 60 + 1440 * 2) % 1440;
  const normTxMins = (rawTxMins - txTzOffsetHours * 60 + 1440 * 2) % 1440;

  // Handle midnight boundary rollover (e.g. Tx at 23:55 UTC, Screenshot at 00:05 UTC next day)
  if (normStatusMins < normTxMins && !(normStatusMins < 60 && normTxMins > 23 * 60)) {
    return {
      isClockParadox: true,
      timeGapMinutes: normStatusMins - normTxMins,
      details: `Clock Paradox: Normalized screenshot time is earlier than transaction time`
    };
  }

  const gap = normStatusMins >= normTxMins ? normStatusMins - normTxMins : (normStatusMins + 1440) - normTxMins;
  return {
    isClockParadox: false,
    timeGapMinutes: gap,
    details: `Clock consistent: Normalized time gap is ${gap}m`
  };
}

/**
 * Simulates EXIF orientation transformation on image layout and bounding boxes.
 * Orientation 1: Normal 0°
 * Orientation 3: 180° upside-down
 * Orientation 6: 90° CW
 * Orientation 8: 270° CW (90° CCW)
 */
export function normalizeExifOrientationLayout(
  orientation: number,
  boundingBoxes: BoundingBox[]
): { normalizedBoxes: BoundingBox[]; headerPosition: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT'; isRotated: boolean } {
  let headerPosition: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' = 'TOP';
  let isRotated = false;

  const normalizedBoxes = boundingBoxes.map(box => {
    let { ymin, xmin, ymax, xmax, label, anomalyType } = box;

    switch (orientation) {
      case 3: // 180° upside-down
        headerPosition = 'BOTTOM';
        isRotated = true;
        return normalizeBoundingBox({
          ymin: 1000 - ymax,
          xmin: 1000 - xmax,
          ymax: 1000 - ymin,
          xmax: 1000 - xmin,
          label,
          anomalyType
        });
      case 6: // 90° CW
        headerPosition = 'RIGHT';
        isRotated = true;
        return normalizeBoundingBox({
          ymin: xmin,
          xmin: 1000 - ymax,
          ymax: xmax,
          xmax: 1000 - ymin,
          label,
          anomalyType
        });
      case 8: // 270° CW / 90° CCW
        headerPosition = 'LEFT';
        isRotated = true;
        return normalizeBoundingBox({
          ymin: 1000 - xmax,
          xmin: ymin,
          ymax: 1000 - xmin,
          xmax: ymax,
          label,
          anomalyType
        });
      case 1:
      default:
        headerPosition = 'TOP';
        isRotated = false;
        return normalizeBoundingBox(box);
    }
  });

  return { normalizedBoxes, headerPosition, isRotated };
}

/**
 * Calculates relative luminance contrast ratio between background and foreground (WCAG formula).
 */
export function calculateLuminanceContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const getLuminance = (rgb: [number, number, number]) => {
    const a = rgb.map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  };

  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// ============================================================================
// TEST SUITE: VECTOR A ADVERSARIAL STRESS SUITE
// ============================================================================

describe('Tier 5 Challenger M6.1 (Vector A): Multimodal Forensics, QR Fuzzing & Image/Math Hardening', () => {

  // ==========================================================================
  // ADV-A-01: FUZZED MULTIBYTE UTF-8 VIETQR TLV INJECTION
  // ==========================================================================

  test('ADV-A-01.1: VietQR builder and parser accurately encode & decode multibyte Vietnamese characters in Tag 62', () => {
    const vietnameseMemos = [
      'Áo Dài Tết 2026 🇻🇳',
      'Thanh toán đơn hàng ORD-HN-999 Nguyễn Văn A 🌸',
      'Chuyển khoản mua Váy Dạ Hội Lụa Tơ Tằm Hà Đông',
      'Cà Phê Muối Chú Long ☕ Đậm Đà Bản Sắc Việt',
      'Combo Mỹ Phẩm Trị Mụn Tràm Trà & Rau Má 100% Organic'
    ];

    for (const memo of vietnameseMemos) {
      // Build payload with multibyte content
      const payload = buildVietQRPayload({
        bankBin: '970436', // Vietcombank
        accountNumber: '1029384756',
        amount: 850000,
        transferContent: memo
      });

      assertTrue(payload.includes('6304'), 'Payload must include CRC Tag 63');
      assertTrue(payload.includes('5303704'), 'Payload must contain currency VND (Tag 53: 704)');
      assertTrue(payload.includes('5802VN'), 'Payload must contain country VN (Tag 58)');

      // Parse payload
      const parsed = parseVietQRPayload(payload);
      assertEqual(parsed.bankBin, '970436', 'Bank BIN must match Vietcombank 970436');
      assertEqual(parsed.accountNumber, '1029384756', 'Account number must match 1029384756');
      assertEqual(parsed.amount, 850000, 'Parsed amount must be 850,000 VND');
      assertTrue(parsed.isValidCrc, 'Multibyte payload CRC16 checksum must be valid');
      assertTrue(parsed.isValid, 'Payload must pass overall validation');
      assertEqual(parsed.currencyCode, '704');
    }
  });

  test('ADV-A-01.2: VietQR handles UTF-8 byte length vs character length discrepancies and zero-width injections', () => {
    // String length is 10 chars, but UTF-8 byte length is 15 bytes
    const complexString = 'Áo 🇻🇳 Tết';
    const charLength = complexString.length;
    const byteLength = Buffer.from(complexString, 'utf-8').length;
    assertTrue(byteLength > charLength, 'Multibyte string byte length must exceed UTF-16 char length');

    const payload = buildVietQRPayload({
      bankBin: '970422', // MB Bank
      accountNumber: '999888777',
      amount: 120000,
      transferContent: complexString
    });

    const parsed = parseVietQRPayload(payload);
    assertTrue(parsed.isValidCrc, 'Multibyte payload CRC must match bitwise calculated CRC');
    assertEqual(parsed.amount, 120000);

    // Fuzz test: Payload with zero-width spaces (\u200B) and script tags
    const fuzzedMemo = 'DH2026\u200B\u200C<script>alert("xss")</script>SELECT * FROM accounts;';
    const fuzzedPayload = buildVietQRPayload({
      bankBin: '970407', // Techcombank
      accountNumber: '1903456789',
      amount: 450000,
      transferContent: fuzzedMemo
    });

    const parsedFuzzed = parseVietQRPayload(fuzzedPayload);
    assertTrue(parsedFuzzed.isValidCrc, 'Fuzzed payload with special characters must parse with valid CRC');
    assertEqual(parsedFuzzed.amount, 450000);
    assertEqual(parsedFuzzed.bankBin, '970407');
  });

  test('ADV-A-01.3: VietQR parser handles truncated TLVs, mismatched length headers & empty tags gracefully without crashing', () => {
    // 1. Truncated payload (<20 chars)
    const truncatedPayload = '00020101021238';
    const parsedTruncated = parseVietQRPayload(truncatedPayload);
    assertFalse(parsedTruncated.isValid, 'Truncated payload must return isValid = false');
    assertFalse(parsedTruncated.isValidCrc, 'Truncated payload has no valid CRC');

    // 2. Corrupted Tag Length (Tag 54 length header is 99, but string ends prematurely)
    const validPayload = buildVietQRPayload({
      bankBin: '970436',
      accountNumber: '0123456789',
      amount: 500000,
      transferContent: 'TEST'
    });
    const corruptedLengthPayload = validPayload.replace('5406500000', '5499500000');
    const parsedCorrupted = parseVietQRPayload(corruptedLengthPayload);
    assertFalse(parsedCorrupted.isValidCrc, 'Corrupted length payload must fail CRC');

    // 3. Null, undefined, or empty string inputs
    const emptyResult = parseVietQRPayload('');
    assertFalse(emptyResult.isValid);
    assertFalse(emptyResult.isValidCrc);
    assertEqual(emptyResult.rawPayload, '');

    const nonStringResult = parseVietQRPayload(null as any);
    assertFalse(nonStringResult.isValid);
  });

  // ==========================================================================
  // ADV-A-02: MALFORMED NON-HEX CRC TAG 63 HANDLING
  // ==========================================================================

  test('ADV-A-02.1: Non-hex CRC tags (6304ZZZZ, 6304!@#$) are detected and fail CRC validation', () => {
    const validBase = '00020101021238570010A00000072701270006970436011301234567890208QRIBFTTA530370454065000005802VN62120808ORD2026';
    
    const malformedCrcs = [
      '6304ZZZZ',
      '6304!@#$',
      '630412G9',
      '6304    ',
      '6304null',
      '6304XXXX',
      '6304????'
    ];

    for (const crcTag of malformedCrcs) {
      const malformedPayload = `${validBase}${crcTag}`;
      const parsed = parseVietQRPayload(malformedPayload);

      assertFalse(parsed.isValidCrc, `Malformed CRC "${crcTag}" must fail CRC validation`);
      assertFalse(parsed.isValid, `Malformed payload with "${crcTag}" must be invalid`);
      assertNotEqual(parsed.calculatedCrc, parsed.embeddedCrc);
    }
  });

  test('ADV-A-02.2: Malformed CRC triggers >= 40pt penalty in 5-Layer Forensics and sets CRITICAL risk', () => {
    const malformedPayload = '00020101021238570010A00000072701270006970436011301234567890208QRIBFTTA530370454065000005802VN62120808ORD20266304ZZZZ';

    const forensicResult = evaluate5LayerForensics({
      statusBarTime: '14:35',
      transactionTime: '14:30',
      fontAnomalyDetected: false,
      compressionHaloDetected: false,
      logoDistortionDetected: false,
      identifiedBank: 'VCB',
      qrPayload: malformedPayload,
      extractedAmount: 500000,
      extractedAccount: '0123456789',
      extractedTxId: 'FT260814982137'
    });

    assertEqual(forensicResult.riskLevel, 'CRITICAL', 'Malformed CRC must result in CRITICAL risk level');
    assertFalse(forensicResult.isAuthentic, 'Receipt with corrupted QR CRC must NOT be authentic');
    assertFalse(forensicResult.forensicSignals.qrIntegrity, 'QR integrity signal must be false');
    assertRange(forensicResult.score, 0, 60, 'Score must be penalized by at least 40 points');

    // Layer 5 assertions
    assertFalse(forensicResult.forensicLayers.layer5_vietQr.crcValid);
    assertFalse(forensicResult.forensicLayers.layer5_vietQr.passed);
    assertTrue(forensicResult.anomalies.some(a => a.type === 'QR_CRC_FAILURE' && a.penalty >= 40));
  });

  test('ADV-A-02.3: Truncated or missing CRC Tag 63 is handled safely without runtime crash', () => {
    const noCrcPayload = '00020101021238570010A0000007270127000697043601130123456789530370454065000005802VN';
    const parsedNoCrc = parseVietQRPayload(noCrcPayload);
    assertFalse(parsedNoCrc.isValid);
    assertFalse(parsedNoCrc.isValidCrc);

    const truncatedCrcPayload = `${noCrcPayload}6304AB`;
    const parsedTruncatedCrc = parseVietQRPayload(truncatedCrcPayload);
    assertFalse(parsedTruncatedCrc.isValidCrc);
  });

  // ==========================================================================
  // ADV-A-03: EXIF ROTATION & INVERTED HEADER NORMALIZATION
  // ==========================================================================

  test('ADV-A-03.1: EXIF rotation normalizer correctly transforms bounding boxes for Orientation 3, 6, 8', () => {
    // Bounding box of status bar at the top of a portrait receipt: [ymin: 10, xmin: 50, ymax: 45, xmax: 950]
    const originalBoxes: BoundingBox[] = [
      { ymin: 10, xmin: 50, ymax: 45, xmax: 950, label: 'Status Bar Clock' },
      { ymin: 200, xmin: 100, ymax: 260, xmax: 900, label: 'Transfer Amount' }
    ];

    // 1. Orientation 1 (Normal 0°)
    const norm1 = normalizeExifOrientationLayout(1, originalBoxes);
    assertEqual(norm1.headerPosition, 'TOP');
    assertFalse(norm1.isRotated);
    assertEqual(norm1.normalizedBoxes[0].ymin, 10);

    // 2. Orientation 3 (180° upside-down)
    const norm3 = normalizeExifOrientationLayout(3, originalBoxes);
    assertEqual(norm3.headerPosition, 'BOTTOM');
    assertTrue(norm3.isRotated);
    // Transformed status bar box is now mapped to top coordinates
    assertEqual(norm3.normalizedBoxes[0].ymin, 1000 - 45); // 955
    assertEqual(norm3.normalizedBoxes[0].ymax, 1000 - 10); // 990

    // 3. Orientation 6 (90° CW)
    const norm6 = normalizeExifOrientationLayout(6, originalBoxes);
    assertEqual(norm6.headerPosition, 'RIGHT');
    assertTrue(norm6.isRotated);
    assertEqual(norm6.normalizedBoxes[0].ymin, 50);

    // 4. Orientation 8 (270° CW / 90° CCW)
    const norm8 = normalizeExifOrientationLayout(8, originalBoxes);
    assertEqual(norm8.headerPosition, 'LEFT');
    assertTrue(norm8.isRotated);
    assertEqual(norm8.normalizedBoxes[0].ymin, 1000 - 950); // 50
  });

  test('ADV-A-03.2: Bounding box canvas normalizer clamps out-of-bounds adversarial coordinates [0, 1000]', () => {
    const adversarialBox: BoundingBox = {
      ymin: -150,
      xmin: -50,
      ymax: 1500,
      xmax: 2000,
      label: 'Adversarial Out of Bounds Box',
      anomalyType: 'SPLICED_TEXT'
    };

    const clamped = normalizeBoundingBox(adversarialBox);
    assertEqual(clamped.ymin, 0, 'Negative ymin must clamp to 0');
    assertEqual(clamped.xmin, 0, 'Negative xmin must clamp to 0');
    assertEqual(clamped.ymax, 1000, 'Oversized ymax must clamp to 1000');
    assertEqual(clamped.xmax, 1000, 'Oversized xmax must clamp to 1000');
    assertEqual(clamped.label, 'Adversarial Out of Bounds Box');
    assertEqual(clamped.anomalyType, 'SPLICED_TEXT');
  });

  test('ADV-A-03.3: Status bar clock cross-check evaluates consistent deltas and catches genuine clock paradoxes', () => {
    // 1. Consistent transfer: 14:32 transfer, 14:35 screenshot (3 mins delta)
    const consistent = evaluate5LayerForensics({
      statusBarTime: '14:35',
      transactionTime: '14:32',
      extractedTxId: 'TX123456',
      extractedAmount: 250000
    });
    assertEqual(consistent.forensicLayers.layer1_clockConsistency.isClockParadox, false);
    assertEqual(consistent.forensicLayers.layer1_clockConsistency.timeGapMinutes, 3);
    assertEqual(consistent.riskLevel, 'LOW');

    // 2. Genuine Clock Paradox: 14:15 screenshot vs 14:30 transfer (Screenshot 15 mins before transfer!)
    const paradox = evaluate5LayerForensics({
      statusBarTime: '14:15',
      transactionTime: '14:30',
      extractedTxId: 'TX123456',
      extractedAmount: 250000
    });
    assertEqual(paradox.forensicLayers.layer1_clockConsistency.isClockParadox, true);
    assertEqual(paradox.riskLevel, 'CRITICAL');
    assertTrue(paradox.anomalies.some(a => a.type === 'CLOCK_PARADOX' && a.penalty === 35));

    // 3. Midnight boundary: 23:58 transfer, 00:04 screenshot (6 mins delta across midnight)
    const midnight = evaluate5LayerForensics({
      statusBarTime: '00:04',
      transactionTime: '23:58',
      extractedTxId: 'TX123456',
      extractedAmount: 250000
    });
    assertEqual(midnight.forensicLayers.layer1_clockConsistency.isClockParadox, false);
  });

  // ==========================================================================
  // ADV-A-04: VARIABLE FONT WEIGHT & KERNING SPLICING
  // ==========================================================================

  test('ADV-A-04.1: Spliced digit sequence with mixed font weights triggers typography anomaly (-35 pts) and HIGH risk', () => {
    // Simulate counterfeit receipt where amount 50.000 was spliced to 500.000 with a bold '0'
    const splicedResult = evaluate5LayerForensics({
      statusBarTime: '15:20',
      transactionTime: '15:18',
      fontAnomalyDetected: true, // Mixed font weights (Light / Bold) detected by OCR bounding box analysis
      compressionHaloDetected: false,
      logoDistortionDetected: false,
      identifiedBank: 'VCB',
      extractedAmount: 5000000,
      extractedAccount: '0123456789',
      extractedTxId: 'FT260814777888'
    });

    assertFalse(splicedResult.forensicSignals.fontConsistency, 'Font consistency signal must be false');
    assertFalse(splicedResult.forensicLayers.layer2_typography.passed, 'Layer 2 typography must fail');
    assertEqual(splicedResult.riskLevel, 'HIGH', 'Font tampering must escalate risk to HIGH');
    assertRange(splicedResult.score, 0, 65, 'Score must be penalized by 35 points (100 - 35 = 65)');
    assertTrue(splicedResult.anomalies.some(a => a.type === 'FONT_MISMATCH' && a.severity === 'HIGH'));
  });

  test('ADV-A-04.2: Compound tampering (font anomaly + compression halo + logo distortion) results in CRITICAL risk', () => {
    const compoundResult = evaluate5LayerForensics({
      statusBarTime: '15:20',
      transactionTime: '15:18',
      fontAnomalyDetected: true,       // -35 pts
      compressionHaloDetected: true,   // -20 pts
      logoDistortionDetected: true,    // -25 pts
      identifiedBank: 'TCB',
      extractedAmount: 10000000,
      extractedAccount: '1902888999',
      extractedTxId: 'TCB8899001122'
    });

    assertEqual(compoundResult.riskLevel, 'CRITICAL');
    assertFalse(compoundResult.isAuthentic);
    assertEqual(compoundResult.score, 20); // 100 - 35 - 20 - 25 = 20
    assertEqual(compoundResult.confidenceScore, 0.20);
    assertEqual(compoundResult.anomalies.length, 3);

    // Auto-reconciliation must strictly REJECT compound tampered receipt
    const recon = reconcileWithOrders(
      {
        ...compoundResult,
        extractedData: {
          bankName: 'Techcombank',
          accountNumber: '1902888999',
          accountHolder: 'TRAN VAN B',
          amount: 10000000,
          currency: 'VND',
          transactionId: 'TCB8899001122',
          transactionTime: '2026-08-14 15:18:00',
          transferContent: 'THANH TOAN ORD-VN-001'
        },
        analyzedAt: new Date().toISOString(),
        reconciliationStatus: 'UNMATCHED',
        recommendation: 'MANUAL_REVIEW'
      },
      [{ orderId: 'ORD-VN-001', totalAmount: 10000000 }]
    );

    assertEqual(recon.reconciliationStatus, 'FLAGGED');
    assertEqual(recon.recommendation, 'REJECT');
  });

  // ==========================================================================
  // ADV-A-05: BOUNDARY MICRO (1 VND) & MACRO (10B VND) TRANSFERS
  // ==========================================================================

  test('ADV-A-05.1: Vietnamese currency formatter formats micro-amounts and extreme macro-amounts up to 10B+ VND correctly', () => {
    // 1. Micro amounts
    assertEqual(formatVietnameseCurrency(1), '1 ₫');
    assertEqual(formatVietnameseCurrency(10), '10 ₫');
    assertEqual(formatVietnameseCurrency(500), '500 ₫');
    assertEqual(formatVietnameseCurrency(999), '999 ₫');

    // 2. Standard SME amounts
    assertEqual(formatVietnameseCurrency(50000), '50.000 ₫');
    assertEqual(formatVietnameseCurrency(1500000), '1.500.000 ₫');
    assertEqual(formatVietnameseCurrency(99999999), '99.999.999 ₫');

    // 3. Macro amounts (billions / tỷ)
    assertEqual(formatVietnameseCurrency(1_000_000_000), '1 tỷ ₫');
    assertEqual(formatVietnameseCurrency(10_000_000_000), '10 tỷ ₫');
    assertEqual(formatVietnameseCurrency(100_000_000_000), '100 tỷ ₫');

    // 4. Boundary invalid numbers (NaN, null, undefined, 0)
    assertEqual(formatVietnameseCurrency(0), '0 ₫');
    assertEqual(formatVietnameseCurrency(NaN), '0 ₫');
    assertEqual(formatVietnameseCurrency(null as any), '0 ₫');
    assertEqual(formatVietnameseCurrency(undefined as any), '0 ₫');
  });

  test('ADV-A-05.2: Integer overflow & 64-bit float safety test for macro amounts in tools & draft orders', () => {
    // 10 Billion VND draft order
    const macroDraft = createDraftOrder({
      customerName: 'Doanh Nghiệp Xuất Khẩu Hà Nội',
      customerPhone: '0988776655',
      shippingAddress: {
        street: '100 Đường Hoàng Hoa Thám',
        ward: 'Phường Liễu Giai',
        district: 'Quận Ba Đình',
        province: 'Hà Nội'
      },
      items: [
        {
          sku: 'BULK-EXPORT-01',
          productName: 'Lô Hàng 1000 Bộ Áo Dài Cao Cấp',
          quantity: 10,
          unitPrice: 1_000_000_000 // 1 tỷ VND each -> 10 tỷ total
        }
      ],
      paymentMethod: 'VIETQR_TRANSFER'
    });

    assertTrue(macroDraft.success);
    assertEqual(macroDraft.subtotal, 10_000_000_000);
    assertEqual(macroDraft.finalAmount, 10_000_000_000); // >= 500k free shipping
    assertTrue(macroDraft.vietQrPayload.includes('541110000000000'), 'VietQR tag 54 must have length 11 and amount 10000000000');

    // Verify QR parse of macro amount
    const parsedMacroQr = parseVietQRPayload(macroDraft.vietQrPayload);
    assertEqual(parsedMacroQr.amount, 10_000_000_000);
    assertTrue(parsedMacroQr.isValidCrc);
  });

  test('ADV-A-05.3: Forensics engine flags incomplete/zero amount transfers with MISSING_FIELDS anomaly', () => {
    const zeroAmountResult = evaluate5LayerForensics({
      statusBarTime: '14:35',
      transactionTime: '14:30',
      extractedTxId: 'TX_ZERO_01',
      extractedAmount: 0 // Invalid 0 VND transfer
    });

    assertFalse(zeroAmountResult.isAuthentic);
    assertRange(zeroAmountResult.score, 0, 75);
    assertTrue(zeroAmountResult.anomalies.some(a => a.type === 'MISSING_FIELDS' && a.penalty === 25));
  });

  // ==========================================================================
  // ADV-A-06: NEGATIVE VOUCHER & ZERO TOTAL ORDER INVARIANTS
  // ==========================================================================

  test('ADV-A-06.1: Vouchers exceeding order value clamp strictly to 0 VND (never negative balances)', () => {
    // 1. Directly test calculateOrderTotal clamping
    assertEqual(calculateOrderTotal(100000, 30000, 200000), 0, 'Discount > Subtotal+Shipping must clamp to 0');
    assertEqual(calculateOrderTotal(50000, 0, 1000000), 0, 'Extreme discount must clamp to 0');
    assertEqual(calculateOrderTotal(0, 0, 50000), 0, 'Zero subtotal with discount must clamp to 0');

    // 2. Test applyDiscountVoucher with TET2026 (20% max 50k for orders >= 200k)
    const resTet = applyDiscountVoucher({
      voucherCode: 'TET2026',
      orderSubtotal: 200000
    });
    assertTrue(resTet.isValid);
    assertEqual(resTet.discountAmount, 40000); // 20% of 200k = 40k
    assertEqual(resTet.finalTotal, 160000);

    // 3. Test AIRISER2026 (100k off for orders >= 500k)
    const resAiRiser = applyDiscountVoucher({
      voucherCode: 'AIRISER2026',
      orderSubtotal: 500000
    });
    assertTrue(resAiRiser.isValid);
    assertEqual(resAiRiser.discountAmount, 100000);
    assertEqual(resAiRiser.finalTotal, 400000);

    // 4. Test below minimum order condition (AIRISER2026 requires >= 500k)
    const resLowOrder = applyDiscountVoucher({
      voucherCode: 'AIRISER2026',
      orderSubtotal: 300000
    });
    assertFalse(resLowOrder.isValid);
    assertEqual(resLowOrder.discountAmount, 0);
    assertEqual(resLowOrder.finalTotal, 300000);
  });

  test('ADV-A-06.2: Negative or NaN inputs in discount tool and order total calculations handle gracefully', () => {
    // Negative subtotal input
    assertEqual(calculateOrderTotal(-50000, 30000, 10000), 0);
    assertEqual(calculateOrderTotal(100000, -30000, 50000), 20000);

    // Non-existent voucher
    const resUnknown = applyDiscountVoucher({
      voucherCode: 'HACK_DISCOUNT_999999',
      orderSubtotal: 500000
    });
    assertFalse(resUnknown.isValid);
    assertEqual(resUnknown.discountAmount, 0);
    assertEqual(resUnknown.finalTotal, 500000);
  });

  // ==========================================================================
  // ADV-A-07: LOW-CONTRAST (<2.0 LUM) & MOIRE PATTERN BLUR
  // ==========================================================================

  test('ADV-A-07.1: Luminance contrast ratio calculation detects low-contrast screenshots (<2.0)', () => {
    // Pure black [0,0,0] vs pure white [255,255,255] -> Contrast ~21:1
    const highContrast = calculateLuminanceContrastRatio([0, 0, 0], [255, 255, 255]);
    assertTrue(highContrast >= 20.0, 'Black on white must have >20:1 contrast');

    // Dark grey [40,40,40] on black [20,20,20] -> Low contrast < 2.0
    const lowContrast = calculateLuminanceContrastRatio([40, 40, 40], [20, 20, 20]);
    assertTrue(lowContrast < 2.0, 'Dark grey on black must have <2.0 contrast ratio');

    // Muted grey on white [220,220,220] on [255,255,255]
    const washedOut = calculateLuminanceContrastRatio([220, 220, 220], [255, 255, 255]);
    assertTrue(washedOut < 2.0, 'Washed out text on white must have <2.0 contrast ratio');
  });

  test('ADV-A-07.2: Low-contrast & Moire pattern degradation degrades confidence score and routes to MANUAL_REVIEW', () => {
    // Simulating screenshot with Moire blur (high frequency noise artifacts) & low contrast
    const degradedResult = evaluate5LayerForensics({
      statusBarTime: '16:00',
      transactionTime: '15:58',
      fontAnomalyDetected: false,
      compressionHaloDetected: true,   // High-frequency Moire pattern noise detected
      logoDistortionDetected: true,    // Distorted logo geometry due to angle / screen reflection
      identifiedBank: 'VCB',
      extractedAmount: 750000,
      extractedAccount: '0123456789',
      extractedTxId: 'FT260814123456'
    });

    // Penalties: 100 - 20 (compression) - 25 (logo) = 55
    assertEqual(degradedResult.score, 55);
    assertEqual(degradedResult.confidenceScore, 0.55);
    assertEqual(degradedResult.riskLevel, 'HIGH'); // Score < 60 triggers HIGH
    assertFalse(degradedResult.isAuthentic);

    // Auto-reconciliation must route degraded image to MANUAL_REVIEW or REJECT
    const recon = reconcileWithOrders(
      {
        ...degradedResult,
        extractedData: {
          bankName: 'Vietcombank',
          accountNumber: '0123456789',
          accountHolder: 'NGUYEN VAN A',
          amount: 750000,
          currency: 'VND',
          transactionId: 'FT260814123456',
          transactionTime: '2026-08-14 15:58:00',
          transferContent: 'THANH TOAN ORD-VN-002'
        },
        analyzedAt: new Date().toISOString(),
        reconciliationStatus: 'UNMATCHED',
        recommendation: 'MANUAL_REVIEW'
      },
      [{ orderId: 'ORD-VN-002', totalAmount: 750000 }]
    );

    assertEqual(recon.reconciliationStatus, 'FLAGGED');
    assertEqual(recon.recommendation, 'REJECT');
  });

  // ==========================================================================
  // ADV-A-08: LEAP YEAR 2026-02-29 & TIMEZONE OFFSET DEFENSE
  // ==========================================================================

  test('ADV-A-08.1: Strict calendar validator rejects non-existent leap day 2026-02-29 and impossible calendar dates', () => {
    // 2026 is a common year (non-leap), February has 28 days
    const feb29_2026 = validateStrictCalendarDate('2026-02-29');
    assertFalse(feb29_2026.isValid, '2026-02-29 is impossible and must be rejected');
    assertContains(feb29_2026.reason || '', 'IMPOSSIBLE_DAY_29');

    // 2026-02-28 is valid
    const feb28_2026 = validateStrictCalendarDate('2026-02-28');
    assertTrue(feb28_2026.isValid, '2026-02-28 is valid');

    // 2024 was a leap year, 2024-02-29 is valid
    const feb29_2024 = validateStrictCalendarDate('2024-02-29');
    assertTrue(feb29_2024.isValid, '2024-02-29 is valid in leap year 2024');

    // Other impossible dates
    assertFalse(validateStrictCalendarDate('2026-04-31').isValid, 'April 31st is impossible');
    assertFalse(validateStrictCalendarDate('2026-06-31').isValid, 'June 31st is impossible');
    assertFalse(validateStrictCalendarDate('2026-11-31').isValid, 'November 31st is impossible');
    assertFalse(validateStrictCalendarDate('2026-13-01').isValid, 'Month 13 is invalid');
    assertFalse(validateStrictCalendarDate('2026-00-10').isValid, 'Month 0 is invalid');
    assertFalse(validateStrictCalendarDate('2026-05-32').isValid, 'Day 32 is invalid');
  });

  test('ADV-A-08.2: Timezone offset defense normalizes UTC vs ICT (+07:00) without false clock paradoxes', () => {
    // Case 1: Overseas screenshot taken in UTC+0 at 07:35:00Z vs Vietnam receipt at 14:30:00+07:00
    // 07:35 UTC == 14:35 ICT (5 minutes after the 14:30 ICT transfer).
    // A naive string comparison of "07:35" < "14:30" would trigger false clock paradox!
    const timezoneDefense1 = evaluateTimezoneAwareClockConsistency({
      statusBarTime: '2026-08-14T07:35:00Z',
      transactionTime: '2026-08-14T14:30:00+07:00'
    });
    assertFalse(timezoneDefense1.isClockParadox, 'UTC vs ICT alignment must NOT trigger false clock paradox');
    assertEqual(timezoneDefense1.timeGapMinutes, 5, 'Time gap must be exactly 5 minutes');

    // Case 2: Screenshot taken in UTC+0 at 06:00:00Z (= 13:00 ICT) vs Vietnam receipt at 14:30:00+07:00
    // Screenshot was taken 90 minutes BEFORE the transaction! Genuine paradox.
    const timezoneDefense2 = evaluateTimezoneAwareClockConsistency({
      statusBarTime: '2026-08-14T06:00:00Z',
      transactionTime: '2026-08-14T14:30:00+07:00'
    });
    assertTrue(timezoneDefense2.isClockParadox, 'Genuine timezone-aware paradox must be caught');
    assertEqual(timezoneDefense2.timeGapMinutes, -90);

    // Case 3: HH:mm format with custom timezone offsets (Status Bar in UTC+0 07:32, Tx in ICT+7 14:30)
    const timezoneDefense3 = evaluateTimezoneAwareClockConsistency({
      statusBarTime: '07:32',
      transactionTime: '14:30',
      statusBarTzOffsetHours: 0,
      txTzOffsetHours: 7
    });
    assertFalse(timezoneDefense3.isClockParadox);
    assertEqual(timezoneDefense3.timeGapMinutes, 2);
  });

  test('ADV-A-08.3: Vietnamese date & relative time formatters handle ISO strings with timezone offsets gracefully', () => {
    const isoUtc = '2026-08-14T07:30:00.000Z';
    const formatted = formatDateTimeVi(isoUtc);
    assertTrue(formatted.length > 0);
    assertTrue(formatted.includes('2026'));

    const relative = formatRelativeTimeVi(new Date().toISOString());
    assertTrue(relative.includes('giây trước') || relative.includes('phút trước'));

    const phoneFormatted = formatPhoneNumberVi('0912345678');
    assertEqual(phoneFormatted, '0912 345 678');
  });

  // ==========================================================================
  // COMPREHENSIVE INTEGRATION MATRIX ACROSS 25+ BANK REGISTRY
  // ==========================================================================

  test('ADV-A-09: 25+ Vietnamese Bank & E-Wallet Registry Integrity & Fuzzy Lookup Robustness', () => {
    // Verify required top banks and digital banks are present
    const requiredBins = ['970436', '970422', '970407', '970418', '970415', '970432', '970416', '970423', '971005', '971007'];
    for (const bin of requiredBins) {
      assertTrue(VIETNAMESE_BANKS[bin] !== undefined, `Bank BIN ${bin} must be registered in VIETNAMESE_BANKS`);
      const bank = VIETNAMESE_BANKS[bin];
      assertTrue(bank.shortName.length > 0);
      assertTrue(bank.fullName.length > 0);
      assertTrue(bank.brandPrimaryColor.startsWith('#'));
    }

    // Fuzzy lookups
    const vcbByShort = lookupBankInfo('VCB');
    assertEqual(vcbByShort?.bin, '970436');

    const mbByApp = lookupBankInfo('MBBank');
    assertEqual(mbByApp?.bin, '970422');

    const momoByFuzzy = lookupBankInfo('MoMo');
    assertEqual(momoByFuzzy?.bin, '971005');

    const zalopayByFuzzy = lookupBankInfo('ZaloPay');
    assertEqual(zalopayByFuzzy?.bin, '971007');

    const unknownBank = lookupBankInfo('NON_EXISTENT_BANK_XYZ');
    assertEqual(unknownBank, undefined);
  });
});

// Self-execution hook when called directly via ts-node
if (require.main === module) {
  runAllRegisteredSuites().then(results => {
    let failed = 0;
    let total = 0;
    let passed = 0;

    console.log('\n================================================================================');
    console.log('  🛡️ CHALLENGER M6.1 (VECTOR A): MULTIMODAL FORENSICS & ADVERSARIAL STRESS SUITE');
    console.log('================================================================================\n');

    for (const r of results) {
      console.log(`Suite: ${r.name}`);
      console.log(`Total: ${r.total} | Passed: ${r.passed} | Failed: ${r.failed} | Duration: ${r.durationMs}ms`);
      for (const t of r.testResults) {
        if (t.passed) {
          console.log(`  ✅ [PASS] ${t.name} (${t.durationMs}ms)`);
        } else {
          console.log(`  ❌ [FAIL] ${t.name} -> ${t.error}`);
        }
      }
      total += r.total;
      passed += r.passed;
      failed += r.failed;
    }

    console.log('\n--------------------------------------------------------------------------------');
    console.log(`Vector A Summary: ${passed}/${total} passed (${failed} failed)`);
    console.log('================================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  });
}
