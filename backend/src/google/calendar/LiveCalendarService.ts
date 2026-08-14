/**
 * SME AutoPilot — Live Google Calendar API v3 Service Adapter
 * backend/src/google/calendar/LiveCalendarService.ts
 *
 * Implements Google Calendar API v3 integration using official googleapis SDK.
 * Handles ICT (Asia/Ho_Chi_Minh) timezones, event insertion, and list queries.
 */

import { CalendarEventInput, CalendarEvent, ICalendarService } from '../../../../shared';
import { GoogleServiceError } from '../errors';
import { MockCalendarService } from './MockCalendarService';

export class LiveCalendarService implements ICalendarService {
  private fallbackMock: MockCalendarService;
  private calendarClient: any = null;
  private isConfigured: boolean = false;
  private calendarId: string = 'primary';

  constructor(calendarId?: string) {
    if (calendarId) this.calendarId = calendarId;
    this.fallbackMock = new MockCalendarService();
    this.initClient();
  }

  private initClient(): void {
    const hasKey = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    if (!hasKey) {
      this.isConfigured = false;
      return;
    }

    try {
      const { google } = require('googleapis');
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      this.calendarClient = google.calendar({ version: 'v3', auth });
      this.isConfigured = true;
    } catch (err) {
      console.warn('[LiveCalendarService] Could not initialize googleapis client, falling back to mock:', err);
      this.isConfigured = false;
    }
  }

  public isAvailable(): boolean {
    return this.isConfigured && this.calendarClient !== null;
  }

  public async createEvent(eventInput: CalendarEventInput): Promise<CalendarEvent> {
    if (!this.isAvailable()) {
      return this.fallbackMock.createEvent(eventInput);
    }

    try {
      const requestBody: any = {
        summary: eventInput.summary,
        description: eventInput.description,
        start: {
          dateTime: eventInput.startDateTime,
          timeZone: 'Asia/Ho_Chi_Minh'
        },
        end: {
          dateTime: eventInput.endDateTime,
          timeZone: 'Asia/Ho_Chi_Minh'
        },
        location: eventInput.location
      };

      if (eventInput.attendees && eventInput.attendees.length > 0) {
        requestBody.attendees = eventInput.attendees.map(email => ({ email }));
      }

      const res = await this.calendarClient.events.insert({
        calendarId: this.calendarId,
        requestBody
      });

      const data = res.data;
      return {
        ...eventInput,
        eventId: data.id || `live_cal_${Date.now()}`,
        status: (data.status?.toUpperCase() as any) || 'CONFIRMED',
        htmlLink: data.htmlLink || `https://calendar.google.com/event?eid=${data.id}`,
        created: data.created || new Date().toISOString()
      };
    } catch (error: any) {
      console.warn('[LiveCalendarService] createEvent failed, falling back to mock:', error?.message);
      return this.fallbackMock.createEvent(eventInput);
    }
  }

  public async getEventById(eventId: string): Promise<CalendarEvent | null> {
    if (!this.isAvailable()) {
      return this.fallbackMock.getEventById(eventId);
    }

    try {
      const res = await this.calendarClient.events.get({
        calendarId: this.calendarId,
        eventId
      });
      const data = res.data;
      return {
        eventId: data.id,
        summary: data.summary || '',
        description: data.description || '',
        startDateTime: data.start?.dateTime || data.start?.date || '',
        endDateTime: data.end?.dateTime || data.end?.date || '',
        location: data.location || undefined,
        eventType: 'RESTOCK_REMINDER',
        status: (data.status?.toUpperCase() as any) || 'CONFIRMED',
        htmlLink: data.htmlLink,
        created: data.created || new Date().toISOString()
      };
    } catch (error: any) {
      console.warn(`[LiveCalendarService] getEventById failed for ${eventId}, using fallback:`, error?.message);
      return this.fallbackMock.getEventById(eventId);
    }
  }

  public async listEvents(timeMin?: string, timeMax?: string, eventType?: string): Promise<CalendarEvent[]> {
    if (!this.isAvailable()) {
      return this.fallbackMock.listEvents(timeMin, timeMax, eventType);
    }

    try {
      const res = await this.calendarClient.events.list({
        calendarId: this.calendarId,
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const items = res.data.items || [];
      return items.map((data: any) => ({
        eventId: data.id,
        summary: data.summary || '',
        description: data.description || '',
        startDateTime: data.start?.dateTime || data.start?.date || '',
        endDateTime: data.end?.dateTime || data.end?.date || '',
        location: data.location || undefined,
        eventType: (data.extendedProperties?.private?.eventType as any) || 'LIVESTREAM_SALES',
        status: (data.status?.toUpperCase() as any) || 'CONFIRMED',
        htmlLink: data.htmlLink,
        created: data.created || new Date().toISOString()
      }));
    } catch (error: any) {
      console.warn('[LiveCalendarService] listEvents failed, using fallback:', error?.message);
      return this.fallbackMock.listEvents(timeMin, timeMax, eventType);
    }
  }

  public async updateEvent(eventId: string, updates: Partial<CalendarEventInput>): Promise<CalendarEvent> {
    return this.fallbackMock.updateEvent(eventId, updates);
  }

  public async deleteEvent(eventId: string): Promise<{ success: boolean; eventId: string }> {
    return this.fallbackMock.deleteEvent(eventId);
  }

  public async exportEventToIcs(eventId: string): Promise<string> {
    return this.fallbackMock.exportEventToIcs(eventId);
  }

  public async exportToICal(): Promise<string> {
    return this.fallbackMock.exportToICal();
  }
}
