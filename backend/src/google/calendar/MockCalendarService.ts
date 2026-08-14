/**
 * SME AutoPilot — In-Memory Stateful Mock Google Calendar Engine
 * backend/src/google/calendar/MockCalendarService.ts
 *
 * Implements:
 * - In-memory event schedule store with ICT (Asia/Ho_Chi_Minh) timezone management
 * - Full CRUD operations on calendar events (create, get, list, update, delete)
 * - RFC 5545 iCalendar (.ics) export generator
 * - Pre-seeded Vietnamese SME business schedules (TikTok livestreams, restock alerts, VIP appointments)
 */

import { CalendarEventInput, CalendarEvent, ICalendarService } from '../../../../shared';
import { CalendarEventError } from '../errors';
import { getSeedCalendarEvents, IndustryType } from '../../seed';

export class MockCalendarService implements ICalendarService {
  private events: Map<string, CalendarEvent> = new Map();

  constructor(initialEvents: CalendarEvent[] = []) {
    if (initialEvents.length > 0) {
      initialEvents.forEach(e => this.events.set(e.eventId, { ...e }));
    } else {
      this.seed('fashion');
    }
  }

  public reset(): void {
    this.events.clear();
  }

  public seed(industry: IndustryType = 'fashion'): void {
    this.reset();
    const seedEvents = getSeedCalendarEvents(industry);
    seedEvents.forEach(e => {
      this.events.set(e.eventId, {
        ...e,
        status: e.status || 'CONFIRMED',
        htmlLink: e.htmlLink || `https://calendar.google.com/event?eid=${e.eventId}`,
        created: e.created || new Date().toISOString()
      });
    });
  }

  public async createEvent(eventInput: CalendarEventInput): Promise<CalendarEvent> {
    if (!eventInput.summary || !eventInput.startDateTime || !eventInput.endDateTime) {
      throw new CalendarEventError('summary, startDateTime, and endDateTime are required to create a calendar event');
    }

    const eventId = `cal_event_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const event: CalendarEvent = {
      ...eventInput,
      eventId,
      status: 'CONFIRMED',
      htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
      iCalUID: `${eventId}@smeautopilot.vn`,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    this.events.set(eventId, event);
    return { ...event };
  }

  public async getEventById(eventId: string): Promise<CalendarEvent | null> {
    const event = this.events.get(eventId);
    return event ? { ...event } : null;
  }

  public async listEvents(timeMin?: string, timeMax?: string, eventType?: string): Promise<CalendarEvent[]> {
    let result = Array.from(this.events.values());

    if (timeMin) {
      const minDate = new Date(timeMin).getTime();
      result = result.filter(e => new Date(e.startDateTime).getTime() >= minDate);
    }

    if (timeMax) {
      const maxDate = new Date(timeMax).getTime();
      result = result.filter(e => new Date(e.endDateTime).getTime() <= maxDate);
    }

    if (eventType) {
      result = result.filter(e => e.eventType === eventType);
    }

    return result.map(e => ({ ...e }));
  }

  public async updateEvent(eventId: string, updates: Partial<CalendarEventInput>): Promise<CalendarEvent> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new CalendarEventError(`Calendar event '${eventId}' not found`, eventId);
    }

    const updated: CalendarEvent = {
      ...event,
      ...updates,
      eventId,
      updated: new Date().toISOString()
    };

    this.events.set(eventId, updated);
    return { ...updated };
  }

  public async deleteEvent(eventId: string): Promise<{ success: boolean; eventId: string }> {
    const existed = this.events.delete(eventId);
    if (!existed) {
      throw new CalendarEventError(`Calendar event '${eventId}' not found for deletion`, eventId);
    }
    return { success: true, eventId };
  }

  private formatIcsDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  public async exportEventToIcs(eventId: string): Promise<string> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new CalendarEventError(`Calendar event '${eventId}' not found for iCal export`, eventId);
    }

    const dtStart = this.formatIcsDate(event.startDateTime);
    const dtEnd = this.formatIcsDate(event.endDateTime);
    const dtStamp = this.formatIcsDate(event.created || new Date().toISOString());

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SME AutoPilot//VN 2026//VI',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.iCalUID || event.eventId + '@smeautopilot.vn'}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${event.summary}`,
      `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
      event.location ? `LOCATION:${event.location}` : '',
      `STATUS:${event.status || 'CONFIRMED'}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ]
      .filter(Boolean)
      .join('\r\n');
  }

  public async exportToICal(): Promise<string> {
    const events = Array.from(this.events.values());
    const eventBlocks = events.map(e => {
      const dtStart = this.formatIcsDate(e.startDateTime);
      const dtEnd = this.formatIcsDate(e.endDateTime);
      const dtStamp = this.formatIcsDate(e.created || new Date().toISOString());
      return [
        'BEGIN:VEVENT',
        `UID:${e.iCalUID || e.eventId + '@smeautopilot.vn'}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${e.summary}`,
        `DESCRIPTION:${e.description.replace(/\n/g, '\\n')}`,
        e.location ? `LOCATION:${e.location}` : '',
        `STATUS:${e.status || 'CONFIRMED'}`,
        'END:VEVENT'
      ]
        .filter(Boolean)
        .join('\r\n');
    });

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SME AutoPilot//VN 2026//VI',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...eventBlocks,
      'END:VCALENDAR'
    ].join('\r\n');
  }
}
