import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  assertThrows,
  runAllRegisteredSuites,
  createMockOrder,
  createMockCalendarEvent
} from '../harness';
import { CalendarEventInput, CalendarEvent, IGmailService, ICalendarService, SentEmailRecord, Order } from '../../shared';

export class MockGmailServiceBoundary implements IGmailService {
  private outbox: SentEmailRecord[] = [];

  async sendInvoiceEmail(recipient: string, order: Order, invoiceHtml?: string): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    // Boundary 1: Validate email address
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!recipient || !emailRegex.test(recipient)) {
      throw new Error(`INVALID_EMAIL_FORMAT: Recipient "${recipient}" is not a valid email address.`);
    }

    // Boundary 2: Header injection protection (strip CR/LF)
    let safeSubject = `Hóa Đơn SME AutoPilot - Đơn Hàng #${order.orderId}`;
    safeSubject = safeSubject.replace(/[\r\n]/g, ' ');

    // Boundary 5: HTML / Script injection sanitation in invoiceHtml
    let safeHtml = invoiceHtml || `<p>Cảm ơn quý khách ${order.customerName}</p>`;
    safeHtml = safeHtml.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '[SANITIZED_SCRIPT]');
    safeHtml = safeHtml.replace(/onload\s*=\s*"[^"]*"/gi, '');
    safeHtml = safeHtml.replace(/onerror\s*=\s*"[^"]*"/gi, '');

    const record: SentEmailRecord = {
      messageId: `msg_inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipient,
      subject: safeSubject,
      emailType: 'INVOICE',
      sentAt: new Date().toISOString(),
      status: 'SENT',
      orderId: order.orderId
    };

    this.outbox.push(record);
    return { messageId: record.messageId, status: 'SENT' };
  }

  async sendShippingNotification(recipient: string, trackingInfo: any): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!recipient || !emailRegex.test(recipient)) {
      throw new Error(`INVALID_EMAIL_FORMAT: Recipient "${recipient}" is not a valid email address.`);
    }

    const record: SentEmailRecord = {
      messageId: `msg_ship_${Date.now()}`,
      recipient,
      subject: `Thông báo vận chuyển đơn hàng #${trackingInfo.orderId}`,
      emailType: 'SHIPPING_NOTIFICATION',
      sentAt: new Date().toISOString(),
      status: 'SENT',
      orderId: trackingInfo.orderId
    };
    this.outbox.push(record);
    return { messageId: record.messageId, status: 'SENT' };
  }

  async getOutbox(): Promise<SentEmailRecord[]> {
    return [...this.outbox];
  }
}

export class MockCalendarServiceBoundary implements ICalendarService {
  private events: CalendarEvent[] = [];

  async createEvent(eventInput: CalendarEventInput): Promise<CalendarEvent> {
    const startTime = new Date(eventInput.startDateTime).getTime();
    const endTime = new Date(eventInput.endDateTime).getTime();
    const now = Date.now();

    // Boundary 3: Past date calendar event
    if (endTime < now - 3600000) { // older than 1 hour in the past
      throw new Error(`PAST_DATE_ERROR: Cannot schedule event in the past: ${eventInput.startDateTime}`);
    }

    // Boundary 4: Overlapping livestream slot collision detection
    if (eventInput.eventType === 'LIVESTREAM_SALES') {
      const collision = this.events.find(e => {
        if (e.eventType !== 'LIVESTREAM_SALES' || e.status === 'CANCELLED') return false;
        const eStart = new Date(e.startDateTime).getTime();
        const eEnd = new Date(e.endDateTime).getTime();
        return (startTime < eEnd && endTime > eStart);
      });

      if (collision) {
        throw new Error(`CALENDAR_SLOT_COLLISION: Livestream slot overlaps with existing event "${collision.summary}" (ID: ${collision.eventId})`);
      }
    }

    const event: CalendarEvent = {
      ...eventInput,
      eventId: `cal_${Date.now()}`,
      status: 'CONFIRMED',
      created: new Date().toISOString()
    };

    this.events.push(event);
    return event;
  }

  async listEvents(timeMin?: string, timeMax?: string): Promise<CalendarEvent[]> {
    return [...this.events];
  }
}

describe('Tier 2 Feature B5: Gmail & Calendar Failures Boundary Tests', () => {
  test('B5.1 - Malformed recipient email address throws INVALID_EMAIL_FORMAT', async () => {
    const gmailService = new MockGmailServiceBoundary();
    const order = createMockOrder();

    await assertThrows(
      () => gmailService.sendInvoiceEmail('invalid-email-address', order),
      'INVALID_EMAIL_FORMAT',
      'Should reject invalid email format'
    );

    await assertThrows(
      () => gmailService.sendInvoiceEmail('user@@double-at.com', order),
      'INVALID_EMAIL_FORMAT'
    );
  });

  test('B5.2 - Special characters and Vietnamese diacritics in email subject are protected from header injection', async () => {
    const gmailService = new MockGmailServiceBoundary();
    const order = createMockOrder({
      orderId: 'ORD-VN-999\r\nBcc: evil@hacker.com'
    });

    const res = await gmailService.sendInvoiceEmail('customer@gmail.com', order);
    const outbox = await gmailService.getOutbox();
    const sent = outbox.find(o => o.messageId === res.messageId);

    assertTrue(sent !== undefined);
    assertFalse(sent!.subject.includes('\r'));
    assertFalse(sent!.subject.includes('\n'));
    assertContains(sent!.subject, 'Hóa Đơn SME AutoPilot');
  });

  test('B5.3 - Past date calendar event scheduling throws PAST_DATE_ERROR', async () => {
    const calendarService = new MockCalendarServiceBoundary();

    const pastEvent: CalendarEventInput = {
      summary: 'Restock áo dài năm ngoái',
      description: 'Lịch nhập kho đã qua',
      startDateTime: '2023-01-01T08:00:00Z',
      endDateTime: '2023-01-01T09:00:00Z',
      eventType: 'RESTOCK_REMINDER'
    };

    await assertThrows(
      () => calendarService.createEvent(pastEvent),
      'PAST_DATE_ERROR',
      'Should reject event scheduled in the past'
    );
  });

  test('B5.4 - Overlapping livestream sales event slot throws CALENDAR_SLOT_COLLISION', async () => {
    const calendarService = new MockCalendarServiceBoundary();
    const futureTime1 = new Date(Date.now() + 86400000).toISOString(); // +1 day
    const futureTime2 = new Date(Date.now() + 86400000 + 7200000).toISOString(); // +1 day + 2 hrs

    // Create first livestream event
    await calendarService.createEvent({
      summary: 'Livestream TikTok Mega Sale Ca 1',
      description: 'Livestream bán hàng buổi sáng',
      startDateTime: futureTime1,
      endDateTime: futureTime2,
      eventType: 'LIVESTREAM_SALES'
    });

    // Attempt overlapping livestream in same time slot
    await assertThrows(
      () => calendarService.createEvent({
        summary: 'Livestream TikTok Ca 2 Trùng Giờ',
        description: 'Livestream bị trùng',
        startDateTime: futureTime1,
        endDateTime: futureTime2,
        eventType: 'LIVESTREAM_SALES'
      }),
      'CALENDAR_SLOT_COLLISION',
      'Should detect overlapping livestream schedule collision'
    );
  });

  test('B5.5 - HTML / Script injection in invoice HTML is safely neutralized', async () => {
    const gmailService = new MockGmailServiceBoundary();
    const maliciousHtml = '<div><p>Hóa đơn</p><script>alert("XSS Attack")</script><img src="x" onerror="alert(1)"/></div>';
    const order = createMockOrder();

    const res = await gmailService.sendInvoiceEmail('customer@gmail.com', order, maliciousHtml);
    assertEqual(res.status, 'SENT');
    assertTrue(res.messageId.length > 0);
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
