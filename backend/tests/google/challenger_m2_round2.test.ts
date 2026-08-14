/**
 * SME AutoPilot — Challenger 2 (Iteration 2) Adversarial Edge Case Test Suite (Milestone 2)
 * backend/tests/google/challenger_m2_round2.test.ts
 *
 * Empirical verification of:
 * 1. GoogleServiceFactory: mode resolution precedence, edge input strings, singleton lifecycle, fallback resilience, multi-industry switching.
 * 2. MockMapsService: geocoding order (district lookup, city fallback, coordinate string handling), edge case distances, TSP route optimization, branch locator.
 * 3. Vietnamese SME Seed Datasets: full schema validation, arithmetic consistency, NAPAS VietQR conformity, phone formats, forensics signal integrity.
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
  createMockInventoryItem,
  createMockOrder,
  createMockTrackingInfo
} from '../../../tests/harness';

import { GoogleServiceFactory, getGoogleFactory } from '../../src/google/factory';
import { MockMapsService, VIETNAM_DISTRICT_COORDINATES } from '../../src/google/maps/MockMapsService';
import { LiveMapsService } from '../../src/google/maps/LiveMapsService';
import {
  getSeedData,
  getSeedInventory,
  getSeedOrders,
  getSeedShopProfile,
  getSeedCalendarEvents,
  getTestReceipts,
  getStoreBranches,
  IndustryType
} from '../../src/seed';
import { LatLng, Order, InventoryItem, RouteStopInput } from '../../../shared';
import { RouteOptimizationError } from '../../src/google/errors';

describe('Challenger 2 (Iteration 2): Google Ecosystem Empirical Edge Case Suite', () => {

  // ==========================================================================
  // SECTION 1: GOOGLE SERVICE FACTORY ADVERSARIAL EDGE CASE TESTING
  // ==========================================================================

  test('ADV-R2-F1: Factory mode resolution handles boundary strings, whitespace, and case variants', () => {
    const factory = new GoogleServiceFactory();

    // Whitespace and case permutations
    assertEqual(factory.resolveMode('  LIVE  '), 'live');
    assertEqual(factory.resolveMode('Live'), 'live');
    assertEqual(factory.resolveMode('DEMO'), 'demo');
    assertEqual(factory.resolveMode('  demo  '), 'demo');
    assertEqual(factory.resolveMode('mock'), 'demo');
    assertEqual(factory.resolveMode('MOCK'), 'demo');
    assertEqual(factory.resolveMode(''), 'demo');
    assertEqual(factory.resolveMode('   '), 'demo');
    assertEqual(factory.resolveMode(undefined), 'demo');
    assertEqual(factory.resolveMode('unknown_mode_xyz'), 'demo');

    // getMode formatting
    factory.setMode('live');
    assertEqual(factory.getMode(), 'LIVE');
    factory.setMode('demo');
    assertEqual(factory.getMode(), 'DEMO');
    factory.setMode('mock');
    assertEqual(factory.getMode(), 'DEMO');
  });

  test('ADV-R2-F2: Factory environment variable resolution hierarchy and precedence matrix', () => {
    const factory = new GoogleServiceFactory();
    const origEnv = { ...process.env };

    try {
      // 1. USE_MOCK_GOOGLE='false' triggers live
      process.env.USE_MOCK_GOOGLE = 'false';
      delete process.env.APP_MODE;
      delete process.env.GOOGLE_INTEGRATION_MODE;
      assertEqual(factory.resolveMode(), 'live');

      // 2. USE_MOCK_GOOGLE='true' overrides other settings if not live
      process.env.USE_MOCK_GOOGLE = 'true';
      assertEqual(factory.resolveMode(), 'demo');

      // 3. APP_MODE='live' triggers live
      delete process.env.USE_MOCK_GOOGLE;
      process.env.APP_MODE = 'live';
      assertEqual(factory.resolveMode(), 'live');

      // 4. GOOGLE_INTEGRATION_MODE='live' triggers live
      delete process.env.APP_MODE;
      process.env.GOOGLE_INTEGRATION_MODE = 'live';
      assertEqual(factory.resolveMode(), 'live');

      // 5. Explicit argument overrides environment variable
      process.env.GOOGLE_INTEGRATION_MODE = 'live';
      assertEqual(factory.resolveMode('demo'), 'demo');
      assertEqual(factory.resolveMode('mock'), 'demo');

      process.env.APP_MODE = 'demo';
      assertEqual(factory.resolveMode('live'), 'live');
    } finally {
      process.env = origEnv;
    }
  });

  test('ADV-R2-F3: Factory per-service modeOverride parameter isolation and fallback resilience', () => {
    const factory = new GoogleServiceFactory('DEMO');

    // In demo mode, requesting live override provides operational instance (with fallback if needed)
    const sheetsLive = factory.getSheetsService('LIVE');
    assertTrue(sheetsLive !== null && sheetsLive !== undefined);

    const gmailLive = factory.getGmailService('LIVE');
    assertTrue(gmailLive !== null && gmailLive !== undefined);

    const calLive = factory.getCalendarService('LIVE');
    assertTrue(calLive !== null && calLive !== undefined);

    const mapsLive = factory.getMapsService('LIVE');
    assertTrue(mapsLive !== null && mapsLive !== undefined);

    const firestoreLive = factory.getFirestoreService('LIVE');
    assertTrue(firestoreLive !== null && firestoreLive !== undefined);

    // Explicit demo override in live factory
    const liveFactory = new GoogleServiceFactory('LIVE');
    const demoSheets = liveFactory.getSheetsService('DEMO');
    assertTrue(demoSheets !== null);
  });

  test('ADV-R2-F4: Factory global helper getGoogleFactory singleton behavior and reconfiguration', () => {
    const f1 = getGoogleFactory();
    const f2 = getGoogleFactory();
    assertEqual(f1, f2, 'getGoogleFactory without args must return the same singleton instance');

    const f3 = getGoogleFactory('DEMO');
    assertTrue(f3 !== null);
    assertEqual(f3.getMode(), 'DEMO');
  });

  test('ADV-R2-F5: Factory multi-industry switching and state reset across all 5 mock services', async () => {
    const factory = new GoogleServiceFactory('DEMO');

    // 1. Seed F&B
    const fnbInfo = factory.loadSeedData('fnb');
    assertEqual(fnbInfo.category, 'fnb');
    assertTrue(fnbInfo.itemCount > 0);

    const fnbSheets = await factory.getSheetsService().getInventory();
    assertTrue(fnbSheets.some(i => i.unit === 'ly'));

    // 2. Seed Cosmetics
    const cosInfo = factory.loadSeedData('cosmetics');
    assertEqual(cosInfo.category, 'cosmetics');
    const cosSheets = await factory.getSheetsService().getInventory();
    assertTrue(cosSheets.some(i => i.name.includes('Serum') || i.name.includes('Kem')));

    // 3. Reset all mocks
    factory.resetMockData();
    const sheetsEmpty = await factory.getSheetsService().getInventory();
    assertEqual(sheetsEmpty.length, 0);

    const outboxEmpty = await factory.getGmailService().getOutbox();
    assertEqual(outboxEmpty.length, 0);

    const calEmpty = await factory.getCalendarService().listEvents();
    assertEqual(calEmpty.length, 0);

    // 4. Seed Fashion and verify full restoration
    const fasInfo = factory.loadSeedData('fashion');
    assertEqual(fasInfo.category, 'fashion');
    const fasSheets = await factory.getSheetsService().getInventory();
    assertTrue(fasSheets.length >= 8);
  });

  // ==========================================================================
  // SECTION 2: MOCK MAPS SERVICE GEOCODING ORDER & ALGORITHMIC RIGOR
  // ==========================================================================

  test('ADV-R2-M1: Geocoding order: District matching precedence and fallback behavior', () => {
    const maps = new MockMapsService();

    // 1. Unaccented district key matching
    const q1 = maps.geocodeAddressSync('10 Le Loi, Quan 1, TP HCM');
    assertEqual(q1.lat, VIETNAM_DISTRICT_COORDINATES['quan 1'].lat);
    assertEqual(q1.lng, VIETNAM_DISTRICT_COORDINATES['quan 1'].lng);

    const q3 = maps.geocodeAddressSync('15 Vo Van Tan, Quan 3, Ho Chi Minh');
    assertEqual(q3.lat, VIETNAM_DISTRICT_COORDINATES['quan 3'].lat);
    assertEqual(q3.lng, VIETNAM_DISTRICT_COORDINATES['quan 3'].lng);

    const q5 = maps.geocodeAddressSync('128 Nguyen Trai, Quan 5, TP.HCM');
    assertEqual(q5.lat, VIETNAM_DISTRICT_COORDINATES['quan 5'].lat);
    assertEqual(q5.lng, VIETNAM_DISTRICT_COORDINATES['quan 5'].lng);

    // 2. English "district" prefix matching
    const d1 = maps.geocodeAddressSync('Le Duan, District 1, HCMC');
    assertEqual(d1.lat, VIETNAM_DISTRICT_COORDINATES['district 1'].lat);

    const d3 = maps.geocodeAddressSync('Nguyen Dinh Chieu, District 3, HCMC');
    assertEqual(d3.lat, VIETNAM_DISTRICT_COORDINATES['district 3'].lat);

    // 3. Hanoi specific streets/districts
    const hnTrangTien = maps.geocodeAddressSync('Nha Hat Lon, trang tien, Ha Noi');
    assertEqual(hnTrangTien.lat, VIETNAM_DISTRICT_COORDINATES['trang tien'].lat);

    const hnCauGiay = maps.geocodeAddressSync('Duong Xuan Thuy, cau giay, Ha Noi');
    assertEqual(hnCauGiay.lat, VIETNAM_DISTRICT_COORDINATES['cau giay'].lat);
  });

  test('ADV-R2-M2: Geocoding order: City fallback hierarchy (HCMC -> Da Nang -> Hanoi default)', () => {
    const maps = new MockMapsService();

    // 1. No district match, but contains HCMC keyword -> falls back to Quan 1
    const hcmAddr1 = maps.geocodeAddressSync('Đường Tên Lạ Không Rõ Quận, Sài Gòn');
    assertEqual(hcmAddr1.lat, VIETNAM_DISTRICT_COORDINATES['quan 1'].lat);

    const hcmAddr2 = maps.geocodeAddressSync('Đường Chưa Đặt Tên, TP Hồ Chí Minh');
    assertEqual(hcmAddr2.lat, VIETNAM_DISTRICT_COORDINATES['quan 1'].lat);

    const hcmCityParam = maps.geocodeAddressSync('Khu công nghiệp mới', 'Ho Chi Minh City');
    assertEqual(hcmCityParam.lat, VIETNAM_DISTRICT_COORDINATES['quan 1'].lat);

    // 2. No district match, but contains Da Nang keyword -> falls back to Hai Chau
    const dnAddr1 = maps.geocodeAddressSync('Khu nghỉ dưỡng ven biển, Đà Nẵng');
    assertEqual(dnAddr1.lat, VIETNAM_DISTRICT_COORDINATES['hai chau'].lat);

    const dnCityParam = maps.geocodeAddressSync('Đường ngoại ô', 'Da Nang');
    assertEqual(dnCityParam.lat, VIETNAM_DISTRICT_COORDINATES['hai chau'].lat);

    // 3. No match at all -> defaults to Hanoi (Hoàn Kiếm)
    const unknownAddr = maps.geocodeAddressSync('Vùng núi phía bắc chưa có tên đường');
    assertEqual(unknownAddr.lat, VIETNAM_DISTRICT_COORDINATES['hoan kiem'].lat);
    assertEqual(unknownAddr.lng, VIETNAM_DISTRICT_COORDINATES['hoan kiem'].lng);
  });

  test('ADV-R2-M3: Shipping Rate Calculator across continuous distance bands and surge modifiers', () => {
    const maps = new MockMapsService();

    // Band 1: 0 - 3.0 km -> 18,000 VND
    assertEqual(maps.calculateShippingRate(0).shippingRateVnd, 18000);
    assertEqual(maps.calculateShippingRate(1.5).shippingRateVnd, 18000);
    assertEqual(maps.calculateShippingRate(3.0).shippingRateVnd, 18000);

    // Band 2: 3.1 - 7.0 km -> 18,000 + (d - 3) * 4000
    // d = 4.0: 18000 + 4000 = 22000
    assertEqual(maps.calculateShippingRate(4.0).shippingRateVnd, 22000);
    // d = 6.5: 18000 + 3.5 * 4000 = 18000 + 14000 = 32000
    assertEqual(maps.calculateShippingRate(6.5).shippingRateVnd, 32000);

    // Band 3: 7.1 - 15.0 km -> 35,000 + (d - 7) * 3500
    // d = 8.0: 35000 + 1 * 3500 = 38500
    assertEqual(maps.calculateShippingRate(8.0).shippingRateVnd, 38500);
    assertEqual(maps.calculateShippingRate(8.0).rateTier, 'SUBURB');

    // Band 4: > 15.0 km -> 55,000 + (d - 15) * 5000
    // d = 25.0: 55000 + 10 * 5000 = 105000
    assertEqual(maps.calculateShippingRate(25.0).shippingRateVnd, 105000);
    assertEqual(maps.calculateShippingRate(25.0).rateTier, 'INTER_PROVINCIAL');

    // Surcharge checks: Rush Hour (+15%)
    const rushRate = maps.calculateShippingRate(10.0, { isRushHour: true });
    // base subtotal = 35000 + 3 * 3500 = 45500. Surcharge = round(45500 * 0.15) = 6825. Total = 52325
    assertEqual(rushRate.shippingRateVnd, 52325);
    assertEqual(rushRate.breakdown.peakHourSurchargeVnd, 6825);

    // Express surge (+15% and tier = EXPRESS)
    const expressRate = maps.calculateShippingRate(2.0, { isExpress: true });
    assertEqual(expressRate.rateTier, 'EXPRESS');
    assertEqual(expressRate.shippingRateVnd, Math.round(18000 * 1.15));
  });

  test('ADV-R2-M4: TSP Route Optimizer handles diverse stop input formats and order objects', async () => {
    const maps = new MockMapsService();
    const depot: LatLng = { lat: 21.0285, lng: 105.8542 }; // Hoan Kiem

    // Mix of string addresses, LatLng objects, RouteStopInput, and Order objects
    const stops: any[] = [
      '45 Tràng Tiền, Hoàn Kiếm, Hà Nội',
      { lat: 21.0362, lng: 105.7906 }, // Cau Giay LatLng
      {
        orderId: 'ORD-CUSTOM-01',
        deliveryAddress: '28 Phố Huế, Hoàn Kiếm',
        customerName: 'Nguyễn Hải Yến',
        customerPhone: '0912345678'
      },
      createMockOrder({
        orderId: 'ORD-MOCK-02',
        deliveryAddress: '15 Bến Nghé, Quận 1',
        city: 'Ho Chi Minh City'
      })
    ];

    const result = await maps.optimizeDeliveryRoute(depot, stops);
    assertEqual(result.totalOrders, 4);
    assertEqual(result.optimizedStops.length, 4);
    assertTrue(result.totalDistanceKm > 0);
    assertTrue(result.totalDurationMinutes > 0);

    // Verify all 4 stops have 1-indexed stopIndex
    const indices = result.optimizedStops.map(s => s.stopIndex);
    assertEqual(indices[0], 1);
    assertEqual(indices[1], 2);
    assertEqual(indices[2], 3);
    assertEqual(indices[3], 4);

    // Verify arrival time monotonicity
    for (let i = 1; i < result.optimizedStops.length; i++) {
      assertTrue(
        result.optimizedStops[i].estimatedArrivalMinutes >= result.optimizedStops[i - 1].estimatedArrivalMinutes
      );
    }
  });

  test('ADV-R2-M5: Store branch nearest resolver across Vietnam geographical extremes', () => {
    const maps = new MockMapsService();

    // 1. Customer in Hai Phong (~100km east of Hanoi) -> should match Hanoi branch
    const haiPhong: LatLng = { lat: 20.8449, lng: 106.6881 };
    const nearHaiPhong = maps.findNearestBranch(haiPhong);
    assertEqual(nearHaiPhong.branch.city, 'Hanoi');
    assertTrue(nearHaiPhong.distanceKm > 50 && nearHaiPhong.distanceKm < 200);

    // 2. Customer in Hue (~100km north of Da Nang) -> should match Da Nang branch
    const hue: LatLng = { lat: 16.4637, lng: 107.5909 };
    const nearHue = maps.findNearestBranch(hue);
    assertEqual(nearHue.branch.city, 'Da Nang');
    assertTrue(nearHue.distanceKm > 50 && nearHue.distanceKm < 200);

    // 3. Customer in Can Tho (~160km south-west of HCMC) -> should match HCMC branch
    const canTho: LatLng = { lat: 10.0452, lng: 105.7469 };
    const nearCanTho = maps.findNearestBranch(canTho);
    assertEqual(nearCanTho.branch.city, 'Ho Chi Minh City');
    assertTrue(nearCanTho.distanceKm > 100 && nearCanTho.distanceKm < 300);
  });

  // ==========================================================================
  // SECTION 3: VIETNAMESE SEED DATASETS COMPREHENSIVE INTEGRITY
  // ==========================================================================

  test('ADV-R2-S1: Exhaustive schema, inventory arithmetic, and VietQR BIN conformity', () => {
    const industries: IndustryType[] = ['fashion', 'fnb', 'cosmetics'];

    const validBins = ['970436', '970407', '970422', '970415', '970418', '970405', '970423']; // VCB, TCB, MB, VietinBank, BIDV, Agribank, TPBank

    for (const ind of industries) {
      const data = getSeedData(ind);

      // Shop Profile
      assertTrue(data.shopProfile.shopName.length > 0);
      assertTrue(data.shopProfile.city.length > 0);
      assertTrue(validBins.includes(data.shopProfile.defaultBankBin), `BIN ${data.shopProfile.defaultBankBin} must be a registered NAPAS BIN in ${ind}`);
      assertTrue(/^\d{6,20}$/.test(data.shopProfile.defaultBankAccount), `Bank account must be digits in ${ind}`);

      // Inventory Items
      for (const item of data.inventory) {
        assertTrue(item.sku.length > 0, `SKU required`);
        assertTrue(item.name.length > 0, `Name required for ${item.sku}`);
        assertTrue(item.price > 0, `Price > 0 for ${item.sku}`);
        assertTrue(item.stock >= 0, `Stock >= 0 for ${item.sku}`);
        assertTrue(item.lowStockThreshold >= 0, `Threshold >= 0 for ${item.sku}`);
        assertTrue(item.unit.length > 0, `Unit required for ${item.sku}`);
      }

      // Orders
      for (const ord of data.orders) {
        assertTrue(ord.orderId.length > 0);
        assertTrue(ord.customerName.length > 0);
        assertTrue(/^(03|05|07|08|09)\d{8}$/.test(ord.customerPhone), `Phone ${ord.customerPhone} must be valid Vietnamese format`);
        assertTrue(ord.items.length >= 1, `Order must have at least 1 item`);

        // Subtotal verification
        const calculatedSubtotal = ord.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        assertEqual(ord.itemsSubtotal, calculatedSubtotal, `itemsSubtotal must equal sum of line items in ${ord.orderId}`);

        // Total verification: subtotal + shipping - discount
        const calculatedTotal = Math.max(0, ord.itemsSubtotal + ord.shippingFee - ord.discountAmount);
        assertEqual(ord.totalAmount, calculatedTotal, `totalAmount must match subtotal+shipping-discount in ${ord.orderId}`);
      }

      // Calendar events
      for (const ev of data.calendarEvents) {
        assertTrue(ev.eventId.length > 0);
        assertTrue(ev.summary.length > 0);
        assertTrue(!isNaN(Date.parse(ev.startDateTime)), `startDateTime must be valid ISO date`);
        assertTrue(!isNaN(Date.parse(ev.endDateTime)), `endDateTime must be valid ISO date`);
        assertTrue(Date.parse(ev.endDateTime) >= Date.parse(ev.startDateTime), `end >= start in ${ev.eventId}`);
      }
    }
  });

  test('ADV-R2-S2: Bank receipt forensics samples cover authentic, manipulated, and compound anomalies', () => {
    const receipts = getTestReceipts();
    assertEqual(receipts.length, 6, 'Must contain 6 distinct test receipts');

    // 1. Authentic VCB receipt
    const r1 = receipts.find(r => r.receiptId === 'REC_VCB_AUTH_001');
    assertTrue(r1 !== undefined);
    assertEqual(r1.isAuthentic, true);
    assertEqual(r1.riskLevel, 'LOW');
    assertEqual(r1.recommendation, 'AUTO_APPROVE');
    assertEqual(r1.forensicSignals.qrIntegrity, true);
    assertEqual(r1.forensicSignals.logoAuthenticity, true);

    // 2. Forged MB receipt (Font tampering + compression + clock paradox)
    const r3 = receipts.find(r => r.receiptId === 'REC_MB_FORGED_003');
    assertTrue(r3 !== undefined);
    assertEqual(r3.isAuthentic, false);
    assertEqual(r3.riskLevel, 'CRITICAL');
    assertEqual(r3.recommendation, 'REJECT');
    assertEqual(r3.forensicSignals.fontConsistency, false);
    assertEqual(r3.forensicSignals.timestampMatch, false);

    // 3. Forged VPBank receipt (Logo color mismatch)
    const r6 = receipts.find(r => r.receiptId === 'REC_VPB_FORGED_006');
    assertTrue(r6 !== undefined);
    assertEqual(r6.isAuthentic, false);
    assertEqual(r6.riskLevel, 'HIGH');
    assertEqual(r6.recommendation, 'REJECT');
    assertEqual(r6.forensicSignals.logoAuthenticity, false);

    // 4. All receipts have OCR text and valid amount in extractedData
    for (const r of receipts) {
      assertTrue(r.extractedData && r.extractedData.amount > 0, `Receipt amount must be > 0 in ${r.receiptId}`);
      assertTrue(r.rawOcrText && r.rawOcrText.length > 20, `OCR text must be populated in ${r.receiptId}`);
    }
  });

  test('ADV-R2-S3: Comprehensive Unicode Vietnamese diacritics integrity across all datasets', () => {
    const fashion = getSeedData('fashion');
    const fnb = getSeedData('fnb');
    const cosmetics = getSeedData('cosmetics');
    const receipts = getTestReceipts();

    const sampleTexts: string[] = [
      fashion.shopProfile.shopName,
      fashion.shopProfile.address,
      ...fashion.inventory.map(i => `${i.name} ${i.category} ${i.unit}`),
      fnb.shopProfile.shopName,
      fnb.shopProfile.address,
      ...fnb.inventory.map(i => `${i.name} ${i.category} ${i.unit}`),
      cosmetics.shopProfile.shopName,
      cosmetics.shopProfile.address,
      ...cosmetics.inventory.map(i => `${i.name} ${i.category} ${i.unit}`),
      ...receipts.map(r => r.rawOcrText)
    ];

    const joined = sampleTexts.join(' | ');

    // 1. Verify no replacement characters or corrupted byte markers
    assertFalse(joined.includes('\uFFFD'), 'Must not contain Unicode replacement character');
    assertFalse(joined.includes('Ã¡') || joined.includes('Ãª') || joined.includes('Ä‘'), 'Must not contain mojibake');
    assertFalse(joined.includes('&amp;amp;'), 'Must not contain double XML escapes');

    // 2. Verify all tone marks and special Vietnamese consonants are present
    const toneMarks = ['á', 'à', 'ả', 'ã', 'ạ', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ', 'é', 'è', 'ẻ', 'ẽ', 'ẹ', 'ế', 'ề', 'ể', 'ễ', 'ệ', 'í', 'ì', 'ỉ', 'ĩ', 'ị', 'ó', 'ò', 'ỏ', 'õ', 'ọ', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ', 'ú', 'ù', 'ủ', 'ũ', 'ụ', 'ứ', 'ừ', 'ử', 'ữ', 'ự', 'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ', 'đ'];

    const matchedTones = toneMarks.filter(t => joined.toLowerCase().includes(t));
    assertTrue(
      matchedTones.length >= 40,
      `Expected at least 40 distinct Vietnamese tone marks in seed data (found ${matchedTones.length})`
    );
  });
});
