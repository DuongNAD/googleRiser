/**
 * SME AutoPilot — Pluggable Google Service Provider Interface (SPI) Factory
 * backend/src/google/factory.ts
 *
 * Implements dynamic mode resolution (DEMO vs LIVE) via:
 * 1. Request headers (X-App-Mode: demo | live)
 * 2. Environment variables (USE_MOCK_GOOGLE, APP_MODE, GOOGLE_INTEGRATION_MODE)
 * 3. Automatic missing credential detection & graceful fallback
 * 4. In-memory persistent state retention across demo requests
 */

import {
  ISheetsService,
  IGmailService,
  ICalendarService,
  IMapsService,
  IFirestoreService,
  IGoogleServiceFactory,
  AppMode,
  ServiceStatusSummary
} from '../../../shared';
import { LiveSheetsService, MockSheetsService } from './sheets';
import { LiveGmailService, MockGmailService } from './gmail';
import { LiveCalendarService, MockCalendarService } from './calendar';
import { LiveMapsService, MockMapsService } from './maps';
import { LiveFirestoreService, MockFirestoreService } from './firebase';
import { getSeedInventory, getSeedOrders, getSeedShopProfile, IndustryType } from '../seed';

export class GoogleServiceFactory implements IGoogleServiceFactory {
  private static instance: GoogleServiceFactory;

  private mode: AppMode = 'demo';

  // Persistent Mock Singletons (maintain state across demo sessions)
  private mockSheets: MockSheetsService;
  private mockGmail: MockGmailService;
  private mockCalendar: MockCalendarService;
  private mockMaps: MockMapsService;
  private mockFirestore: MockFirestoreService;

  // Live Service Singletons (connection pooling)
  private liveSheets?: LiveSheetsService;
  private liveGmail?: LiveGmailService;
  private liveCalendar?: LiveCalendarService;
  private liveMaps?: LiveMapsService;
  private liveFirestore?: LiveFirestoreService;

  constructor(defaultMode?: string) {
    if (defaultMode) {
      this.mode = this.resolveMode(defaultMode);
    } else {
      this.mode = this.resolveMode();
    }

    this.mockSheets = new MockSheetsService();
    this.mockGmail = new MockGmailService();
    this.mockCalendar = new MockCalendarService();
    this.mockMaps = new MockMapsService();
    this.mockFirestore = new MockFirestoreService();
  }

  public static getInstance(): GoogleServiceFactory {
    if (!GoogleServiceFactory.instance) {
      GoogleServiceFactory.instance = new GoogleServiceFactory();
    }
    return GoogleServiceFactory.instance;
  }

  public resolveMode(requestedMode?: string): AppMode {
    if (requestedMode) {
      const lower = requestedMode.toLowerCase().trim();
      if (lower === 'live') return 'live';
      if (lower === 'demo' || lower === 'mock') return 'demo';
    }

    // Check environment variables
    const envMock = process.env.USE_MOCK_GOOGLE;
    if (envMock === 'false' || process.env.APP_MODE === 'live' || process.env.GOOGLE_INTEGRATION_MODE === 'live') {
      return 'live';
    }

    return 'demo'; // Safe zero-friction default
  }

  public getMode(): string {
    return this.mode === 'live' ? 'LIVE' : 'DEMO';
  }

  public setMode(mode: any): void {
    this.mode = this.resolveMode(String(mode));
  }

  public getSheetsService(modeOverride?: string): ISheetsService {
    const effectiveMode = modeOverride ? this.resolveMode(modeOverride) : this.mode;
    if (effectiveMode === 'live') {
      try {
        if (!this.liveSheets) this.liveSheets = new LiveSheetsService();
        return this.liveSheets;
      } catch (err) {
        console.warn('[GoogleServiceFactory] Failed to initialize LiveSheetsService, using mock fallback:', err);
        return this.mockSheets;
      }
    }
    return this.mockSheets;
  }

  public getGmailService(modeOverride?: string): IGmailService {
    const effectiveMode = modeOverride ? this.resolveMode(modeOverride) : this.mode;
    if (effectiveMode === 'live') {
      try {
        if (!this.liveGmail) this.liveGmail = new LiveGmailService();
        return this.liveGmail;
      } catch (err) {
        console.warn('[GoogleServiceFactory] Failed to initialize LiveGmailService, using mock fallback:', err);
        return this.mockGmail;
      }
    }
    return this.mockGmail;
  }

  public getCalendarService(modeOverride?: string): ICalendarService {
    const effectiveMode = modeOverride ? this.resolveMode(modeOverride) : this.mode;
    if (effectiveMode === 'live') {
      try {
        if (!this.liveCalendar) this.liveCalendar = new LiveCalendarService();
        return this.liveCalendar;
      } catch (err) {
        console.warn('[GoogleServiceFactory] Failed to initialize LiveCalendarService, using mock fallback:', err);
        return this.mockCalendar;
      }
    }
    return this.mockCalendar;
  }

  public getMapsService(modeOverride?: string): IMapsService {
    const effectiveMode = modeOverride ? this.resolveMode(modeOverride) : this.mode;
    if (effectiveMode === 'live') {
      try {
        if (!this.liveMaps) this.liveMaps = new LiveMapsService();
        return this.liveMaps;
      } catch (err) {
        console.warn('[GoogleServiceFactory] Failed to initialize LiveMapsService, using mock fallback:', err);
        return this.mockMaps;
      }
    }
    return this.mockMaps;
  }

  public getFirestoreService(modeOverride?: string): IFirestoreService {
    const effectiveMode = modeOverride ? this.resolveMode(modeOverride) : this.mode;
    if (effectiveMode === 'live') {
      try {
        if (!this.liveFirestore) this.liveFirestore = new LiveFirestoreService();
        return this.liveFirestore;
      } catch (err) {
        console.warn('[GoogleServiceFactory] Failed to initialize LiveFirestoreService, using mock fallback:', err);
        return this.mockFirestore;
      }
    }
    return this.mockFirestore;
  }

  // Demo State Management APIs
  public resetAllMocks(): void {
    this.mockSheets.reset();
    this.mockGmail.reset();
    this.mockCalendar.reset();
    this.mockMaps.reset();
    this.mockFirestore.reset();
  }

  public resetMockData(): void {
    this.resetAllMocks();
  }

  public seedAllMocks(dataset: 'fashion' | 'fnb' | 'cosmetics' = 'fashion'): void {
    this.mockSheets.seed(dataset);
    this.mockFirestore.seed(dataset);
    this.mockCalendar.seed(dataset);
  }

  public loadSeedData(industry: 'fashion' | 'fnb' | 'cosmetics'): { category: string; shopName: string; itemCount: number } {
    const profile = getSeedShopProfile(industry);
    const items = getSeedInventory(industry);
    this.seedAllMocks(industry);
    return {
      category: profile.businessCategory || industry,
      shopName: profile.shopName || 'SME Shop',
      itemCount: items.length
    };
  }

  public getStatus(): ServiceStatusSummary {
    const hasGoogleAuth = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const hasMapsKey = !!process.env.GOOGLE_MAPS_API_KEY;
    const hasFirebase = !!(
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_SERVICE_ACCOUNT
    );

    return {
      mode: this.mode,
      sheets: { mode: this.mode, status: 'operational' },
      gmail: { mode: this.mode, status: 'operational' },
      calendar: { mode: this.mode, status: 'operational' },
      maps: { mode: this.mode, status: 'operational' },
      firestore: { mode: this.mode, status: 'operational' },
      credentialsConfigured: {
        googleAuth: hasGoogleAuth,
        googleMaps: hasMapsKey,
        firebase: hasFirebase
      }
    };
  }
}

// Global factory helper
let defaultFactory: GoogleServiceFactory | null = null;

export function getGoogleFactory(defaultMode?: string): GoogleServiceFactory {
  if (!defaultFactory || defaultMode) {
    defaultFactory = new GoogleServiceFactory(defaultMode);
  }
  return defaultFactory;
}
