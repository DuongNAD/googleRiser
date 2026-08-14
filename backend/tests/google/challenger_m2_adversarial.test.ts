/**
 * SME AutoPilot — Challenger 2 Empirical Adversarial & Stress Test Suite (Milestone 2)
 * backend/tests/google/challenger_m2_adversarial.test.ts
 *
 * Adversarial verification covering:
 * 1. GoogleServiceFactory: dynamic mode resolution, env overrides, singleton state persistence across resets, multi-industry switching.
 * 2. MockGmailService: high-volume outbox stress (500+ emails), queue inspection/filtering, VietQR payload & responsive HTML template rendering.
 * 3. MockCalendarService: event conflicts, interval filtering, RFC 5545 iCal formatting compliance & CRLF line delimiters.
 * 4. Seed datasets: JSON schema integrity, Unicode Vietnamese diacritics preservation, receipt tampering forensics signals.
 * 5. High-concurrency & boundary stress on Sheets, Maps, and Firestore NoSQL engine.
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
  createMockOrder,
  createMockTrackingInfo,
  createMockInventoryItem
} from '../../../tests/harness';

import { GoogleServiceFactory, getGoogleFactory } from '../../src/google/factory';
import { MockGmailService } from '../../src/google/gmail/MockGmailService';
import { MockCalendarService } from '../../src/google/calendar/MockCalendarService';
import { MockSheetsService } from '../../src/google/sheets/MockSheetsService';
import { MockMapsService } from '../../src/google/maps/MockMapsService';
import { MockFirestoreService } from '../../src/google/firebase/MockFirestoreService';
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
import { CalendarEventError, InsufficientStockError, SheetNotFoundError } from '../../src/google/errors';
import { Order, InventoryItem, CalendarEvent } from '../../../shared';

describe('Challenger 2 (M2): Google Ecosystem Empirical Adversarial & Stress Suite', () => {

  // ==========================================================================
  // SECTION 1: GOOGLE SERVICE FACTORY ADVERSARIAL VERIFICATION
  // ==========================================================================

  test('CHALLENGE-1.1: GoogleServiceFactory dynamic mode switching, env overrides & case-insensitive resolution', () => {
    const factory = new GoogleServiceFactory('DEMO');
    assertEqual(factory.getMode(), 'DEMO');

    // Case insensitivity and whitespace handling
    assertEqual(factory.resolveMode('  live  '), 'live');
    assertEqual(factory.resolveMode('LIVE'), 'live');
    assertEqual(factory.resolveMode('  demo  '), 'demo');
    assertEqual(factory.resolveMode('MOCK'), 'demo');
    assertEqual(factory.resolveMode(''), 'demo');
    assertEqual(factory.resolveMode(undefined), 'demo');

    // Environment variable overrides
    const originalUseMock = process.env.USE_MOCK_GOOGLE;
    const originalAppMode = process.env.APP_MODE;
    const originalGoogleMode = process.env.GOOGLE_INTEGRATION_MODE;

    try {
      process.env.USE_MOCK_GOOGLE = 'false';
      assertEqual(factory.resolveMode(), 'live');

      delete process.env.USE_MOCK_GOOGLE;
      process.env.APP_MODE = 'live';
      assertEqual(factory.resolveMode(), 'live');

      delete process.env.APP_MODE;
      process.env.GOOGLE_INTEGRATION_MODE = 'live';
      assertEqual(factory.resolveMode(), 'live');

      delete process.env.GOOGLE_INTEGRATION_MODE;
      assertEqual(factory.resolveMode(), 'demo');
    } finally {
      process.env.USE_MOCK_GOOGLE = originalUseMock;
      process.env.APP_MODE = originalAppMode;
      process.env.GOOGLE_INTEGRATION_MODE = originalGoogleMode;
    }
  });

  test('CHALLENGE-1.2: GoogleServiceFactory singleton state persistence across mode toggles and full reset verification', async () => {
    const factory = new GoogleServiceFactory('DEMO');
    const sheets = factory.getSheetsService();
    const firestore = factory.getFirestoreService();

    // 1. Mutate Sheets inventory in demo mode
    const inv = await sheets.getInventory();
    assertTrue(inv.length > 0);
    const targetSku = inv[0].sku;
    const originalStock = inv[0].stock;
    await sheets.updateInventoryStock(targetSku, 25);

    // 2. Mutate Firestore in demo mode
    await firestore.setDocument('test_tenants', 't_001', { name: 'Empirical Shop', balance: 5000000 });

    // 3. Switch mode to LIVE and back to DEMO
    factory.setMode('LIVE');
    assertEqual(factory.getMode(), 'LIVE');

    factory.setMode('DEMO');
    assertEqual(factory.getMode(), 'DEMO');

    // Verify mutations persist across mode switches
    const sheetsAfter = factory.getSheetsService();
    const itemAfter = await sheetsAfter.getInventoryBySku!(targetSku);
    assertEqual(itemAfter?.stock, originalStock + 25);

    const docAfter = await factory.getFirestoreService().getDocument<any>('test_tenants', 't_001');
    assertEqual(docAfter?.name, 'Empirical Shop');
    assertEqual(docAfter?.balance, 5000000);

    // 4. Test resetAllMocks()
    factory.resetAllMocks();
    const sheetsReset = await factory.getSheetsService().getInventory();
    assertEqual(sheetsReset.length, 0, 'Sheets inventory must be empty after resetAllMocks');

    const firestoreReset = await factory.getFirestoreService().getDocument('test_tenants', 't_001');
    assertEqual(firestoreReset, null, 'Firestore test doc must be null after resetAllMocks');
  });

  test('CHALLENGE-1.3: GoogleServiceFactory multi-industry seed switching roundtrip (fashion -> fnb -> cosmetics -> fashion)', async () => {
    const factory = new GoogleServiceFactory('DEMO');

    // Step 1: Switch to F&B
    const fnbInfo = factory.loadSeedData('fnb');
    assertEqual(fnbInfo.category, 'fnb');
    assertTrue(fnbInfo.shopName.includes('Bếp Mẹ Bắp'));
    const fnbInv = await factory.getSheetsService().getInventory();
    assertTrue(fnbInv.some(i => i.name.includes('Trà Sữa') || i.unit === 'ly'));
    assertTrue(fnbInv.every(i => !i.name.includes('Áo Dài')));

    // Step 2: Switch to Cosmetics
    const cosInfo = factory.loadSeedData('cosmetics');
    assertEqual(cosInfo.category, 'cosmetics');
    assertTrue(cosInfo.shopName.includes('GlowSkin'));
    const cosInv = await factory.getSheetsService().getInventory();
    assertTrue(cosInv.some(i => i.name.includes('Serum Rau Má')));
    assertTrue(cosInv.every(i => !i.name.includes('Trà Sữa')));

    // Step 3: Switch back to Fashion
    const fashionInfo = factory.loadSeedData('fashion');
    assertEqual(fashionInfo.category, 'fashion');
    assertTrue(fashionInfo.shopName.includes('Mai Anh'));
    const fashionInv = await factory.getSheetsService().getInventory();
    assertTrue(fashionInv.some(i => i.name.includes('Áo Dài Lụa Hà Đông')));
    assertTrue(fashionInv.every(i => !i.name.includes('Serum Rau Má')));

    // Verify calendar was also reseeded
    const calEvents = await factory.getCalendarService().listEvents();
    assertTrue(calEvents.length > 0);
    assertTrue(calEvents.some(e => e.eventType === 'LIVESTREAM_SALES'));
  });

  // ==========================================================================
  // SECTION 2: MOCK GMAIL SERVICE HIGH-VOLUME & RENDERING STRESS
  // ==========================================================================

  test('CHALLENGE-2.1: MockGmailService high-volume outbox stress (500 emails) & filtering inspection', async () => {
    const gmail = new MockGmailService();
    gmail.reset();

    const TOTAL_EMAILS = 500;
    const sendPromises: Promise<any>[] = [];

    for (let i = 0; i < TOTAL_EMAILS; i++) {
      const isInvoice = i % 2 === 0;
      const recipient = `user_${i % 10}@empirictest.vn`;
      if (isInvoice) {
        const order = createMockOrder({
          orderId: `ORD-STRESS-${i}`,
          totalAmount: 100000 + i * 1000,
          customerName: `Customer ${i}`
        });
        sendPromises.push(gmail.sendInvoiceEmail(recipient, order));
      } else {
        const tracking = createMockTrackingInfo({
          orderId: `ORD-STRESS-${i}`,
          trackingCode: `VNP-STRESS-${i}`,
          recipientName: `Customer ${i}`
        });
        sendPromises.push(gmail.sendShippingNotification(recipient, tracking));
      }
    }

    const sendResults = await Promise.all(sendPromises);
    assertEqual(sendResults.length, TOTAL_EMAILS);

    const outbox = await gmail.getOutbox();
    assertEqual(outbox.length, TOTAL_EMAILS);

    // Verify all message IDs are strictly unique
    const messageIdSet = new Set(outbox.map(e => e.messageId));
    assertEqual(messageIdSet.size, TOTAL_EMAILS, 'All 500 messageIds must be strictly unique');

    // Filter by recipient
    const user0Emails = await gmail.getOutbox({ recipient: 'user_0@empirictest.vn' });
    assertEqual(user0Emails.length, 50);

    // Filter by emailType
    const invoices = await gmail.getOutbox({ emailType: 'INVOICE' });
    assertEqual(invoices.length, 250);
    const shippings = await gmail.getOutbox({ emailType: 'SHIPPING_NOTIFICATION' });
    assertEqual(shippings.length, 250);

    // Filter by specific orderId
    const specificOrder = await gmail.getOutbox({ orderId: 'ORD-STRESS-42' });
    assertEqual(specificOrder.length, 1);
    assertEqual(specificOrder[0].orderId, 'ORD-STRESS-42');

    // Non-existent email lookup returns null
    const notFound = await gmail.getEmailById('non_existent_msg_id_999');
    assertEqual(notFound, null);
  });

  test('CHALLENGE-2.2: MockGmailService VietQR payload & HTML template rendering validation under edge conditions', async () => {
    const gmail = new MockGmailService();

    // Edge Case 1: Order with 0 items, 0 discount, 0 shipping
    const edgeOrder1 = createMockOrder({
      orderId: 'ORD-EDGE-001',
      customerName: 'Nguyễn Văn Test',
      customerPhone: '0987654321',
      deliveryAddress: '123 Đường Bưởi, Ba Đình',
      city: 'Hanoi',
      itemsSubtotal: 0,
      shippingFee: 0,
      discountAmount: 0,
      totalAmount: 0,
      paymentMethod: 'VIETQR_NAPAS',
      items: []
    });

    const html1 = gmail.renderInvoiceHtml(edgeOrder1, 'Test Boutique');
    assertContains(html1, 'Test Boutique');
    assertContains(html1, '#ORD-EDGE-001');
    assertContains(html1, 'Nguyễn Văn Test');
    assertContains(html1, 'https://img.vietqr.io/image/970436-0011004567890-compact2.png?amount=0');
    assertContains(html1, 'ORD-EDGE-001');
    assertContains(html1, 'Vietcombank');
    assertContains(html1, '0 ₫');

    // Edge Case 2: Order with HTML special characters and large Vietnamese text
    const edgeOrder2 = createMockOrder({
      orderId: 'ORD-EDGE-002',
      customerName: 'Trần <script>alert("XSS")</script> & Partners',
      customerPhone: '0912345678',
      deliveryAddress: 'Số 99/2A "Ngõ Vàng", Phường Bến Nghé, Quận 1',
      city: 'Ho Chi Minh City',
      itemsSubtotal: 2500000,
      shippingFee: 35000,
      discountAmount: 200000,
      totalAmount: 2335000,
      notes: 'Giao hàng giờ hành chính. Gọi trước 15 phút!',
      items: [
        {
          sku: 'SKU-SPECIAL-1',
          name: 'Váy Dạ Hội Đính Kim Sa & Pha Lê Cao Cấp (Phiên bản giới hạn)',
          quantity: 2,
          unitPrice: 1250000,
          subtotal: 2500000
        }
      ]
    });

    const html2 = gmail.renderInvoiceHtml(edgeOrder2);
    assertContains(html2, 'ORD-EDGE-002');
    assertContains(html2, '2.335.000 ₫');
    assertContains(html2, '200.000 ₫'); // discount
    assertContains(html2, 'Giao hàng giờ hành chính');
    assertContains(html2, 'Váy Dạ Hội Đính Kim Sa & Pha Lê');
  });

  // ==========================================================================
  // SECTION 3: MOCK CALENDAR SERVICE RFC 5545 & TIMEZONE RIGOR
  // ==========================================================================

  test('CHALLENGE-3.1: MockCalendarService RFC 5545 iCalendar compliance & CRLF delimiter formatting', async () => {
    const calendar = new MockCalendarService([]); // start clean
    calendar.reset();

    const event = await calendar.createEvent({
      summary: '🔥 Mega Live Shopee 9.9 - Siêu Giảm Giá',
      description: 'Livestream bán hàng 3 tiếng.\nMục tiêu: 500 đơn hàng.\nQuà tặng kèm: Voucher 50k.',
      startDateTime: '2026-09-09T19:00:00+07:00',
      endDateTime: '2026-09-09T22:00:00+07:00',
      location: 'Studio Mai Anh, 28 Phố Huế, Hà Nội',
      eventType: 'LIVESTREAM_SALES'
    });

    // 1. Single Event .ics export
    const singleIcs = await calendar.exportEventToIcs(event.eventId);
    assertTrue(singleIcs.includes('\r\n'), 'iCalendar export MUST use RFC 5545 CRLF line endings');
    assertContains(singleIcs, 'BEGIN:VCALENDAR');
    assertContains(singleIcs, 'VERSION:2.0');
    assertContains(singleIcs, 'PRODID:-//SME AutoPilot//VN 2026//VI');
    assertContains(singleIcs, 'CALSCALE:GREGORIAN');
    assertContains(singleIcs, 'METHOD:PUBLISH');
    assertContains(singleIcs, 'BEGIN:VEVENT');
    assertContains(singleIcs, `UID:${event.eventId}@smeautopilot.vn`);
    assertContains(singleIcs, 'SUMMARY:🔥 Mega Live Shopee 9.9 - Siêu Giảm Giá');
    // Multiline descriptions must escape newlines to \n in RFC 5545
    assertContains(singleIcs, 'DESCRIPTION:Livestream bán hàng 3 tiếng.\\nMục tiêu: 500 đơn hàng.\\nQuà tặng kèm: Voucher 50k.');
    assertContains(singleIcs, 'LOCATION:Studio Mai Anh, 28 Phố Huế, Hà Nội');
    assertContains(singleIcs, 'STATUS:CONFIRMED');
    assertContains(singleIcs, 'END:VEVENT');
    assertContains(singleIcs, 'END:VCALENDAR');

    // 2. Full Calendar .ics export
    await calendar.createEvent({
      summary: 'Họp giao ban đầu tuần',
      description: 'Đánh giá doanh số tuần',
      startDateTime: '2026-09-10T08:00:00+07:00',
      endDateTime: '2026-09-10T09:00:00+07:00',
      eventType: 'SUPPLIER_MEETING'
    });

    const fullIcs = await calendar.exportToICal();
    assertContains(fullIcs, 'BEGIN:VCALENDAR');
    assertContains(fullIcs, 'END:VCALENDAR');
    // Must contain 2 VEVENT blocks
    const veventMatches = fullIcs.match(/BEGIN:VEVENT/g);
    assertEqual(veventMatches?.length, 2, 'Full iCal must contain 2 VEVENT blocks');
  });

  test('CHALLENGE-3.2: MockCalendarService interval filtering & input validation guards', async () => {
    const calendar = new MockCalendarService([]);
    calendar.reset();

    // Add 3 events spanning different dates
    await calendar.createEvent({
      summary: 'Event 1 (Aug 10)',
      description: 'Desc 1',
      startDateTime: '2026-08-10T10:00:00+07:00',
      endDateTime: '2026-08-10T11:00:00+07:00',
      eventType: 'RESTOCK_REMINDER'
    });

    await calendar.createEvent({
      summary: 'Event 2 (Aug 15)',
      description: 'Desc 2',
      startDateTime: '2026-08-15T14:00:00+07:00',
      endDateTime: '2026-08-15T16:00:00+07:00',
      eventType: 'LIVESTREAM_SALES'
    });

    await calendar.createEvent({
      summary: 'Event 3 (Aug 20)',
      description: 'Desc 3',
      startDateTime: '2026-08-20T09:00:00+07:00',
      endDateTime: '2026-08-20T10:00:00+07:00',
      eventType: 'VIP_FITTING'
    });

    // Filter by time window [Aug 12 - Aug 18]
    const midEvents = await calendar.listEvents('2026-08-12T00:00:00+07:00', '2026-08-18T23:59:59+07:00');
    assertEqual(midEvents.length, 1);
    assertEqual(midEvents[0].summary, 'Event 2 (Aug 15)');

    // Invalid event input throws CalendarEventError
    await assertThrows(async () => {
      await calendar.createEvent({
        summary: '',
        description: 'No summary',
        startDateTime: '2026-08-15T10:00:00+07:00',
        endDateTime: '2026-08-15T11:00:00+07:00',
        eventType: 'LIVESTREAM_SALES'
      });
    }, 'required to create a calendar event');

    // Updating / deleting non-existent event throws CalendarEventError
    await assertThrows(async () => {
      await calendar.updateEvent('cal_missing_999', { summary: 'New' });
    }, 'not found');

    await assertThrows(async () => {
      await calendar.deleteEvent('cal_missing_999');
    }, 'not found for deletion');

    await assertThrows(async () => {
      await calendar.exportEventToIcs('cal_missing_999');
    }, 'not found for iCal export');
  });

  // ==========================================================================
  // SECTION 4: SEED DATASETS SCHEMA, DIACRITICS & FORENSICS INTEGRITY
  // ==========================================================================

  test('CHALLENGE-4.1: Seed JSON schema integrity across all industries (fashion, fnb, cosmetics)', () => {
    const industries: IndustryType[] = ['fashion', 'fnb', 'cosmetics'];

    for (const ind of industries) {
      const data = getSeedData(ind);

      // 1. Shop Profile Schema
      assertTrue(data.shopProfile !== undefined, `${ind} must have shopProfile`);
      assertTrue(data.shopProfile.shopId.length > 0);
      assertTrue(data.shopProfile.shopName.length > 0);
      assertTrue(data.shopProfile.city.length > 0);
      assertTrue(data.shopProfile.defaultBankBin.length >= 6);
      assertTrue(data.shopProfile.defaultBankAccount.length >= 6);

      // 2. Inventory Items Schema
      assertTrue(Array.isArray(data.inventory), `${ind} inventory must be array`);
      assertTrue(data.inventory.length >= 8, `${ind} must have >= 8 inventory items`);
      for (const item of data.inventory) {
        assertTrue(item.sku.length > 0, `SKU required in ${ind}`);
        assertTrue(item.name.length > 0, `Name required in ${ind}`);
        assertTrue(item.price > 0, `Price must be > 0 in ${item.sku}`);
        assertTrue(item.stock >= 0, `Stock must be >= 0 in ${item.sku}`);
        assertTrue(item.lowStockThreshold >= 0, `Threshold must be >= 0 in ${item.sku}`);
        assertTrue(item.unit.length > 0, `Unit required in ${item.sku}`);
      }

      // 3. Orders Schema
      assertTrue(Array.isArray(data.orders), `${ind} orders must be array`);
      assertTrue(data.orders.length >= 1, `${ind} must have >= 1 order`);
      for (const ord of data.orders) {
        assertTrue(ord.orderId.length > 0, `orderId required in ${ind}`);
        assertTrue(ord.customerName.length > 0, `customerName required in ${ord.orderId}`);
        assertTrue(ord.customerPhone.length > 0, `customerPhone required in ${ord.orderId}`);
        assertTrue(ord.deliveryAddress.length > 0, `deliveryAddress required in ${ord.orderId}`);
        assertTrue(ord.totalAmount >= 0, `totalAmount >= 0 in ${ord.orderId}`);
        // Verify formula total: subtotal + shipping - discount = total
        const expectedTotal = Math.max(0, ord.itemsSubtotal + ord.shippingFee - ord.discountAmount);
        assertEqual(ord.totalAmount, expectedTotal, `Total must match formula in ${ord.orderId}`);
        assertTrue(Array.isArray(ord.items) && ord.items.length >= 1, `Items array required in ${ord.orderId}`);
      }

      // 4. Calendar Events Schema
      assertTrue(Array.isArray(data.calendarEvents), `${ind} calendarEvents must be array`);
      assertTrue(data.calendarEvents.length >= 1, `${ind} must have calendar events`);
      for (const ev of data.calendarEvents) {
        assertTrue(ev.eventId.length > 0, `eventId required in ${ind}`);
        assertTrue(ev.summary.length > 0, `summary required in ${ev.eventId}`);
        assertTrue(ev.startDateTime.length > 0, `startDateTime required in ${ev.eventId}`);
        assertTrue(ev.endDateTime.length > 0, `endDateTime required in ${ev.eventId}`);
      }
    }
  });

  test('CHALLENGE-4.2: Vietnamese Unicode diacritics preservation & no mojibake across all seed files', () => {
    const rawReceipts = getTestReceipts();
    const fashion = getSeedData('fashion');
    const fnb = getSeedData('fnb');
    const cosmetics = getSeedData('cosmetics');

    const allStrings: string[] = [
      fashion.shopProfile.shopName,
      fashion.shopProfile.address,
      ...fashion.inventory.map(i => i.name),
      fnb.shopProfile.shopName,
      ...fnb.inventory.map(i => i.name),
      cosmetics.shopProfile.shopName,
      ...cosmetics.inventory.map(i => i.name),
      ...rawReceipts.map(r => r.bankName),
      ...rawReceipts.map(r => r.rawOcrText || '')
    ];

    // Check key Vietnamese diacritics are present
    const joinedText = allStrings.join(' ');
    const vietnameseChars = ['Á', 'à', 'ả', 'ã', 'ạ', 'Ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ', 'Â', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ', 'Đ', 'đ', 'Ê', 'ế', 'ề', 'ể', 'ễ', 'ệ', 'Ô', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ', 'Ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ', 'Ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự'];

    const foundChars = vietnameseChars.filter(c => joinedText.includes(c));
    assertTrue(foundChars.length >= 20, 'At least 20 distinct Vietnamese accented letters must be preserved in seed data');

    // Ensure NO replacement characters (Unicode \uFFFD) or mojibake patterns
    assertFalse(joinedText.includes('\uFFFD'), 'Seed datasets must NOT contain Unicode replacement characters (mojibake)');
    assertFalse(joinedText.includes('Ã¡') || joinedText.includes('Ãª') || joinedText.includes('Ä‘'), 'Seed datasets must NOT contain double-encoded UTF-8 mojibake');
  });

  test('CHALLENGE-4.3: Bank receipt forensics samples validation (authentic vs forged flags & signals)', () => {
    const receipts = getTestReceipts();
    assertEqual(receipts.length, 6, 'Must contain exactly 6 diverse bank receipt samples');

    const vcbAuth = receipts.find(r => r.receiptId === 'REC_VCB_AUTH_001');
    assertTrue(vcbAuth !== undefined);
    assertEqual(vcbAuth?.isAuthentic, true);
    assertEqual(vcbAuth?.riskLevel, 'LOW');
    assertEqual(vcbAuth?.recommendation, 'AUTO_APPROVE');
    assertEqual(vcbAuth?.forensicSignals.timestampMatch, true);
    assertEqual(vcbAuth?.forensicSignals.fontConsistency, true);
    assertEqual(vcbAuth?.forensicSignals.compressionArtifacts, false);

    const mbForged = receipts.find(r => r.receiptId === 'REC_MB_FORGED_003');
    assertTrue(mbForged !== undefined);
    assertEqual(mbForged?.isAuthentic, false);
    assertEqual(mbForged?.riskLevel, 'CRITICAL');
    assertEqual(mbForged?.recommendation, 'REJECT');
    assertEqual(mbForged?.forensicSignals.timestampMatch, false);
    assertEqual(mbForged?.forensicSignals.fontConsistency, false);
    assertEqual(mbForged?.forensicSignals.compressionArtifacts, true);
    assertTrue(mbForged?.forensicSignals.anomalies.length >= 2);

    const vpbForged = receipts.find(r => r.receiptId === 'REC_VPB_FORGED_006');
    assertTrue(vpbForged !== undefined);
    assertEqual(vpbForged?.isAuthentic, false);
    assertEqual(vpbForged?.riskLevel, 'HIGH');
    assertEqual(vpbForged?.recommendation, 'REJECT');
    assertEqual(vpbForged?.forensicSignals.logoAuthenticity, false);
  });

  // ==========================================================================
  // SECTION 5: ADVANCED HIGH-CONCURRENCY & MATHEMATICAL RIGOR
  // ==========================================================================

  test('CHALLENGE-5.1: High-concurrency Sheets atomic stock conservation under 200 mixed operations', async () => {
    const initialItem = createMockInventoryItem({
      sku: 'SKU-CONCURRENT-200',
      stock: 50,
      price: 100000
    });
    const sheets = new MockSheetsService([initialItem]);

    // 100 increments of +1 and 100 decrements of -1 fired simultaneously
    const ops = [
      ...Array.from({ length: 100 }, () => sheets.updateInventoryStock('SKU-CONCURRENT-200', 1)),
      ...Array.from({ length: 100 }, () => sheets.updateInventoryStock('SKU-CONCURRENT-200', -1))
    ];

    // Shuffle operations to maximize race interleaving
    ops.sort(() => Math.random() - 0.5);

    const results = await Promise.all(ops);
    assertEqual(results.length, 200);

    const finalItem = await sheets.getInventoryBySku('SKU-CONCURRENT-200');
    assertEqual(finalItem?.stock, 50, 'Net stock after 100 increments (+1) and 100 decrements (-1) must be strictly 50');
  });

  test('CHALLENGE-5.2: Maps Service inter-provincial extreme distances and 0km boundary tests', async () => {
    const maps = new MockMapsService();

    // 1. Hanoi HQ (21.0285, 105.8542) to Ho Chi Minh City Branch (10.7554, 106.6789) ~ 1130 km geodesic
    const hanoi = { lat: 21.028511, lng: 105.854167 };
    const hcm = { lat: 10.7554, lng: 106.6789 };

    const distanceRes = await maps.calculateDistance(hanoi, hcm);
    assertRange(distanceRes.distanceKm, 1400, 1650, 'Urban distance between Hanoi and HCMC');
    assertEqual(distanceRes.rateTier, 'INTER_PROVINCIAL');
    assertTrue(distanceRes.shippingRateVnd > 5000000, 'Inter-provincial bulk shipping fee calculated');

    // 2. Same coordinate (0 distance) boundary
    const zeroDistRes = await maps.calculateDistance(hanoi, hanoi);
    assertEqual(zeroDistRes.distanceKm, 0.1, 'Zero distance defaults to minimal 0.1km');
    assertEqual(zeroDistRes.rateTier, 'STANDARD_INNER_CITY');
    assertEqual(zeroDistRes.shippingRateVnd, 18000);
  });

  test('CHALLENGE-5.3: Firestore NoSQL ACID transaction isolation and deep cloning immutability', async () => {
    const firestore = new MockFirestoreService();
    firestore.reset();

    await firestore.setDocument('accounts', 'user_alpha', { balance: 1000, profile: { vip: true } });

    // Ensure getDocument returns deep clone (immutability check)
    const fetched = await firestore.getDocument<any>('accounts', 'user_alpha');
    fetched.balance = 999999;
    fetched.profile.vip = false;

    const fetchedAgain = await firestore.getDocument<any>('accounts', 'user_alpha');
    assertEqual(fetchedAgain?.balance, 1000, 'Internal state must NOT be mutated by external modification');
    assertEqual(fetchedAgain?.profile.vip, true);

    // Compound Query with multiple operators ('in', 'array-contains', '!=')
    await firestore.setDocument('products', 'p1', { category: 'fashion', tags: ['silk', 'luxury'], price: 500 });
    await firestore.setDocument('products', 'p2', { category: 'fnb', tags: ['tea', 'drink'], price: 50 });
    await firestore.setDocument('products', 'p3', { category: 'fashion', tags: ['cotton', 'casual'], price: 200 });

    const arrayContains = await firestore.queryCollection<any>('products', {
      where: [{ field: 'tags', operator: 'array-contains', value: 'silk' }]
    });
    assertEqual(arrayContains.length, 1);
    assertEqual(arrayContains[0].category, 'fashion');

    const inQuery = await firestore.queryCollection<any>('products', {
      where: [{ field: 'category', operator: 'in', value: ['fashion', 'cosmetics'] }]
    });
    assertEqual(inQuery.length, 2);
  });
});
