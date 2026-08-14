/**
 * SME AutoPilot — Google Calendar Service Test Suite
 * backend/tests/google/calendar.test.ts
 */

import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  assertThrows,
  createMockCalendarEvent
} from '../../../tests/harness';
import { MockCalendarService } from '../../src/google/calendar/MockCalendarService';
import { LiveCalendarService } from '../../src/google/calendar/LiveCalendarService';

describe('Google Calendar Service & RFC 5545 iCal Test Suite', () => {
  test('Calendar: Creates livestream sales schedule with attendees and ICT timezone', async () => {
    const service = new MockCalendarService();
    const event = await service.createEvent({
      summary: '🔥 Mega Live TikTok Shop 8.8',
      description: 'Livestream bán hàng 2 tiếng trên TikTok Shop. Mục tiêu 200 đơn hàng.',
      startDateTime: '2026-08-15T19:30:00+07:00',
      endDateTime: '2026-08-15T21:30:00+07:00',
      location: 'Studio Mai Anh Boutique - 28 Phố Huế',
      eventType: 'LIVESTREAM_SALES',
      attendees: ['host@smeautopilot.vn', 'sale@smeautopilot.vn']
    });

    assertEqual(event.status, 'CONFIRMED');
    assertEqual(event.eventType, 'LIVESTREAM_SALES');
    assertTrue(event.eventId.startsWith('cal_event_'));
    assertTrue(event.attendees?.includes('host@smeautopilot.vn') ?? false);
  });

  test('Calendar: Lists and filters events by time window and event type', async () => {
    const service = new MockCalendarService();
    await service.createEvent({
      summary: '📦 Nhập Hàng Lụa Vạn Phúc',
      description: 'Lấy 50 bộ áo dài',
      startDateTime: '2026-08-16T09:00:00+07:00',
      endDateTime: '2026-08-16T10:00:00+07:00',
      eventType: 'RESTOCK_REMINDER'
    });

    await service.createEvent({
      summary: '👑 Thử Đồ VIP Khách Hàng',
      description: 'Thử đầm dạ hội',
      startDateTime: '2026-08-17T15:00:00+07:00',
      endDateTime: '2026-08-17T16:00:00+07:00',
      eventType: 'VIP_FITTING'
    });

    const allEvents = await service.listEvents();
    assertTrue(allEvents.length >= 2);

    const restockEvents = await service.listEvents(undefined, undefined, 'RESTOCK_REMINDER');
    assertTrue(restockEvents.some(e => e.summary.includes('Nhập Hàng')));

    const futureEvents = await service.listEvents('2026-08-17T00:00:00+07:00');
    assertTrue(futureEvents.every(e => new Date(e.startDateTime).getTime() >= new Date('2026-08-17T00:00:00+07:00').getTime()));
  });

  test('Calendar: Updates and deletes scheduled events', async () => {
    const service = new MockCalendarService();
    const created = await service.createEvent({
      summary: 'Họp Nhà Cung Cấp Vải',
      description: 'Bàn kế hoạch mùa đông',
      startDateTime: '2026-08-18T10:00:00+07:00',
      endDateTime: '2026-08-18T11:00:00+07:00',
      eventType: 'SUPPLIER_MEETING'
    });

    const updated = await service.updateEvent(created.eventId, {
      summary: 'Họp Nhà Cung Cấp Vải Vạn Phúc (Dời giờ)',
      startDateTime: '2026-08-18T14:00:00+07:00',
      endDateTime: '2026-08-18T15:00:00+07:00'
    });

    assertEqual(updated.summary, 'Họp Nhà Cung Cấp Vải Vạn Phúc (Dời giờ)');
    assertEqual(updated.startDateTime, '2026-08-18T14:00:00+07:00');

    // Delete event
    const delRes = await service.deleteEvent(created.eventId);
    assertTrue(delRes.success);

    const check = await service.getEventById(created.eventId);
    assertEqual(check, null);
  });

  test('Calendar: Generates valid RFC 5545 .ics iCalendar file content for export', async () => {
    const service = new MockCalendarService();
    const event = await service.createEvent({
      summary: 'Mega Sale TikTok Shop',
      description: 'Livestream đặc biệt',
      startDateTime: '2026-08-15T19:30:00+07:00',
      endDateTime: '2026-08-15T21:30:00+07:00',
      location: 'Hà Nội',
      eventType: 'LIVESTREAM_SALES'
    });

    const icsContent = await service.exportEventToIcs(event.eventId);
    assertContains(icsContent, 'BEGIN:VCALENDAR');
    assertContains(icsContent, 'VERSION:2.0');
    assertContains(icsContent, 'BEGIN:VEVENT');
    assertContains(icsContent, 'SUMMARY:Mega Sale TikTok Shop');
    assertContains(icsContent, 'LOCATION:Hà Nội');
    assertContains(icsContent, 'END:VEVENT');
    assertContains(icsContent, 'END:VCALENDAR');

    const fullCalendarIcs = await service.exportToICal();
    assertContains(fullCalendarIcs, 'BEGIN:VCALENDAR');
    assertContains(fullCalendarIcs, 'END:VCALENDAR');
  });

  test('Calendar: LiveCalendarService operates cleanly with fallback', async () => {
    const liveService = new LiveCalendarService();
    const event = await liveService.createEvent({
      summary: 'Live Test Event',
      description: 'Testing live calendar adapter',
      startDateTime: '2026-08-20T10:00:00+07:00',
      endDateTime: '2026-08-20T11:00:00+07:00',
      eventType: 'ORDER_PICKUP'
    });

    assertTrue(event.eventId.length > 0);
    const list = await liveService.listEvents();
    assertTrue(list.length > 0);
  });
});
