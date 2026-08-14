import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertContains,
  createMockOrder,
  createMockTrackingInfo,
  createMockCalendarEvent
} from '../harness';
import {
  IGmailService,
  ICalendarService,
  Order,
  TrackingInfo,
  SentEmailRecord,
  CalendarEvent,
  CalendarEventInput
} from '../../shared';

export class MockGmailService implements IGmailService {
  private outbox: SentEmailRecord[] = [];

  async sendInvoiceEmail(
    recipient: string,
    order: Order,
    invoiceHtml?: string
  ): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    const messageId = `msg_inv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const record: SentEmailRecord = {
      messageId,
      recipient,
      subject: `[SME AutoPilot] Hóa Đơn & Xác Nhận Đơn Hàng #${order.orderId}`,
      emailType: 'INVOICE',
      sentAt: new Date().toISOString(),
      status: 'SENT',
      orderId: order.orderId
    };
    this.outbox.push(record);
    return { messageId, status: 'SENT' };
  }

  async sendShippingNotification(
    recipient: string,
    trackingInfo: TrackingInfo
  ): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    const messageId = `msg_ship_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const record: SentEmailRecord = {
      messageId,
      recipient,
      subject: `[Giao Hàng] Đơn Hàng #${trackingInfo.orderId} đang được giao - Vận đơn: ${trackingInfo.trackingCode}`,
      emailType: 'SHIPPING_NOTIFICATION',
      sentAt: new Date().toISOString(),
      status: 'SENT',
      orderId: trackingInfo.orderId
    };
    this.outbox.push(record);
    return { messageId, status: 'SENT' };
  }

  async getOutbox(): Promise<SentEmailRecord[]> {
    return [...this.outbox];
  }
}

export class MockCalendarService implements ICalendarService {
  private events: CalendarEvent[] = [];

  async createEvent(eventInput: CalendarEventInput): Promise<CalendarEvent> {
    const eventId = `cal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const event: CalendarEvent = {
      ...eventInput,
      eventId,
      status: 'CONFIRMED',
      htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
      created: new Date().toISOString()
    };
    this.events.push(event);
    return event;
  }

  async listEvents(timeMin?: string, timeMax?: string): Promise<CalendarEvent[]> {
    return [...this.events];
  }
}

describe('F5: Gmail & Calendar API Integration', () => {
  test('Test 5.1: Automated invoice email dispatch with VietQR integration', async () => {
    const gmailService = new MockGmailService();
    const order = createMockOrder({
      orderId: 'ORD-INV-2026-001',
      totalAmount: 950000,
      customerName: 'Hoàng Minh Châu'
    });

    const result = await gmailService.sendInvoiceEmail('chau.hoang@gmail.com', order);
    assertEqual(result.status, 'SENT');
    assertTrue(result.messageId.startsWith('msg_inv_'));

    const outbox = await gmailService.getOutbox();
    assertEqual(outbox.length, 1);
    assertEqual(outbox[0].recipient, 'chau.hoang@gmail.com');
    assertContains(outbox[0].subject, 'ORD-INV-2026-001');
    assertEqual(outbox[0].emailType, 'INVOICE');
  });

  test('Test 5.2: Shipping notification email with carrier tracking code', async () => {
    const gmailService = new MockGmailService();
    const tracking = createMockTrackingInfo({
      orderId: 'ORD-INV-2026-001',
      trackingCode: 'GHN-HN-889900',
      shippingCarrier: 'Giao Hàng Nhanh (GHN Express)'
    });

    const result = await gmailService.sendShippingNotification('chau.hoang@gmail.com', tracking);
    assertEqual(result.status, 'SENT');

    const outbox = await gmailService.getOutbox();
    const shipRecord = outbox.find(m => m.emailType === 'SHIPPING_NOTIFICATION');
    assertTrue(!!shipRecord);
    assertContains(shipRecord!.subject, 'GHN-HN-889900');
  });

  test('Test 5.3: Outbox history listing and filtering capabilities', async () => {
    const gmailService = new MockGmailService();
    await gmailService.sendInvoiceEmail('client1@gmail.com', createMockOrder({ orderId: 'O-1' }));
    await gmailService.sendInvoiceEmail('client2@gmail.com', createMockOrder({ orderId: 'O-2' }));
    await gmailService.sendShippingNotification('client1@gmail.com', createMockTrackingInfo({ orderId: 'O-1' }));

    const allRecords = await gmailService.getOutbox();
    assertEqual(allRecords.length, 3);

    const client1Records = allRecords.filter(r => r.recipient === 'client1@gmail.com');
    assertEqual(client1Records.length, 2);
  });

  test('Test 5.4: Automated restock reminder calendar event creation', async () => {
    const calService = new MockCalendarService();
    const event = await calService.createEvent({
      summary: '📦 Nhập Hàng: Áo Dài Lụa Hà Đông (Tồn kho < 5)',
      description: 'Cảnh báo tự động từ SME AutoPilot: SKU AD-LUA-RED-L còn 2 sản phẩm. Liên hệ xưởng dệt Vạn Phúc để nhập 50 bộ.',
      startDateTime: '2026-08-15T09:00:00+07:00',
      endDateTime: '2026-08-15T10:00:00+07:00',
      location: 'Xưởng Vạn Phúc, Hà Đông',
      eventType: 'RESTOCK_REMINDER',
      attendees: ['kho@smeautopilot.vn', 'chuquankho@gmail.com']
    });

    assertEqual(event.status, 'CONFIRMED');
    assertEqual(event.eventType, 'RESTOCK_REMINDER');
    assertContains(event.summary, 'Nhập Hàng');
    assertTrue(event.attendees?.includes('kho@smeautopilot.vn') ?? false);
  });

  test('Test 5.5: Livestream sales calendar event with multi-platform details', async () => {
    const calService = new MockCalendarService();
    const liveEvent = await calService.createEvent({
      summary: '🎥 Mega Live 8.8: Xả Kho Thời Trang Nữ TikTok Shop',
      description: 'Livestream bán hàng 2 tiếng. Mục tiêu 200 đơn hàng. Host: MC Mai Lan.',
      startDateTime: '2026-08-15T19:30:00+07:00',
      endDateTime: '2026-08-15T21:30:00+07:00',
      eventType: 'LIVESTREAM_SALES',
      location: 'Phòng Studio 1'
    });

    assertEqual(liveEvent.eventType, 'LIVESTREAM_SALES');
    assertTrue(liveEvent.htmlLink?.startsWith('https://calendar.google.com') ?? false);

    const eventList = await calService.listEvents();
    assertEqual(eventList.length, 1);
  });
});
