/**
 * SME AutoPilot — Gmail Service Test Suite
 * backend/tests/google/gmail.test.ts
 */

import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  createMockOrder,
  createMockTrackingInfo,
  createMockInventoryItem
} from '../../../tests/harness';
import { MockGmailService } from '../../src/google/gmail/MockGmailService';
import { LiveGmailService } from '../../src/google/gmail/LiveGmailService';

describe('Gmail API & Responsive Vietnamese Email Engine Test Suite', () => {
  test('Gmail: Dispatches responsive HTML invoice email with embedded VietQR payment badge', async () => {
    const service = new MockGmailService();
    const order = createMockOrder({
      orderId: 'ORD-TEST-INV-001',
      totalAmount: 650000,
      customerName: 'Hoàng Minh Châu',
      itemsSubtotal: 650000,
      shippingFee: 20000,
      discountAmount: 20000,
      items: [
        {
          sku: 'FAS-AD-HD-RED-M',
          name: 'Áo Dài Lụa Hà Đông Đỏ Ruby',
          quantity: 1,
          unitPrice: 650000,
          subtotal: 650000
        }
      ]
    });

    const res = await service.sendInvoiceEmail('chau.hoang@gmail.com', order);
    assertEqual(res.status, 'SENT');
    assertTrue(res.messageId.startsWith('msg_inv_'));

    const outbox = await service.getOutbox();
    assertEqual(outbox.length, 1);
    assertEqual(outbox[0].recipient, 'chau.hoang@gmail.com');
    assertContains(outbox[0].subject, 'ORD-TEST-INV-001');
    assertEqual(outbox[0].emailType, 'INVOICE');

    // Verify rendered HTML body contents
    const html = outbox[0].htmlBody || '';
    assertContains(html, 'Hoàng Minh Châu');
    assertContains(html, 'Áo Dài Lụa Hà Đông Đỏ Ruby');
    assertContains(html, '650.000 ₫');
    assertContains(html, 'img.vietqr.io');
    assertContains(html, 'Vietcombank');
  });

  test('Gmail: Sends shipping notification email with VNPost/GHN tracking status stepper', async () => {
    const service = new MockGmailService();
    const tracking = createMockTrackingInfo({
      orderId: 'ORD-SHIP-991',
      trackingCode: 'VNP-HN-2026-9988',
      shippingCarrier: 'VNPost Express Hà Nội',
      recipientName: 'Lê Thu Trang'
    });

    const res = await service.sendShippingNotification('trang.le@gmail.com', tracking);
    assertEqual(res.status, 'SENT');

    const outbox = await service.getOutbox({ emailType: 'SHIPPING_NOTIFICATION' });
    assertEqual(outbox.length, 1);
    assertContains(outbox[0].subject, 'VNP-HN-2026-9988');

    const html = outbox[0].htmlBody || '';
    assertContains(html, 'Đã lấy hàng');
    assertContains(html, 'Đang giao hàng');
    assertContains(html, 'VNPost Express');
  });

  test('Gmail: Sends automated warehouse restock alerts for low-inventory items', async () => {
    const service = new MockGmailService();
    const lowStockItems = [
      createMockInventoryItem({ sku: 'SKU-LOW-1', name: 'Sơ Mi Tơ Dập Ly', stock: 2 }),
      createMockInventoryItem({ sku: 'SKU-LOW-2', name: 'Đầm Satin Vàng', stock: 1 })
    ];

    const res = await service.sendRestockAlert('kho@maianhboutique.vn', lowStockItems);
    assertEqual(res.status, 'SENT');

    const outbox = await service.getOutbox({ emailType: 'RESTOCK_ALERT' });
    assertEqual(outbox.length, 1);
    assertContains(outbox[0].subject, 'CẢNH BÁO KHO');
  });

  test('Gmail: Filters and inspects outbox queue by recipient, type, and message ID', async () => {
    const service = new MockGmailService();
    await service.sendInvoiceEmail('user1@gmail.com', createMockOrder({ orderId: 'O-1' }));
    await service.sendInvoiceEmail('user2@gmail.com', createMockOrder({ orderId: 'O-2' }));
    await service.sendShippingNotification('user1@gmail.com', createMockTrackingInfo({ orderId: 'O-1' }));

    const all = await service.getOutbox();
    assertEqual(all.length, 3);

    const user1Emails = await service.getOutbox({ recipient: 'user1@gmail.com' });
    assertEqual(user1Emails.length, 2);

    const invoiceEmails = await service.getOutbox({ emailType: 'INVOICE' });
    assertEqual(invoiceEmails.length, 2);

    const firstMsgId = all[0].messageId;
    const retrieved = await service.getEmailById(firstMsgId);
    assertEqual(retrieved?.messageId, firstMsgId);

    // Clear outbox
    service.clearOutbox();
    const afterClear = await service.getOutbox();
    assertEqual(afterClear.length, 0);
  });

  test('Gmail: LiveGmailService provides fallback send and query capability', async () => {
    const liveService = new LiveGmailService();
    const order = createMockOrder({ orderId: 'ORD-LIVE-TEST' });
    const res = await liveService.sendInvoiceEmail('merchant.test@gmail.com', order);

    assertTrue(res.status === 'SENT' || res.status === 'QUEUED');
    assertTrue(res.messageId.length > 0);
  });
});
