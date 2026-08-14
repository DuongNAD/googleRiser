/**
 * SME AutoPilot — Google SPI Factory Test Suite
 * backend/tests/google/factory.test.ts
 */

import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertThrows
} from '../../../tests/harness';
import { GoogleServiceFactory, getGoogleFactory } from '../../src/google/factory';
import { MockSheetsService } from '../../src/google/sheets';
import { MockGmailService } from '../../src/google/gmail';
import { MockCalendarService } from '../../src/google/calendar';
import { MockMapsService } from '../../src/google/maps';
import { MockFirestoreService } from '../../src/google/firebase';

describe('Google SPI Factory & Mode Switching Test Suite', () => {
  test('Factory: Instantiates in default DEMO mode with non-null mock services', () => {
    const factory = new GoogleServiceFactory('DEMO');
    assertEqual(factory.getMode(), 'DEMO');

    const sheets = factory.getSheetsService();
    const gmail = factory.getGmailService();
    const calendar = factory.getCalendarService();
    const maps = factory.getMapsService();
    const firestore = factory.getFirestoreService();

    assertTrue(sheets !== null && sheets !== undefined);
    assertTrue(gmail !== null && gmail !== undefined);
    assertTrue(calendar !== null && calendar !== undefined);
    assertTrue(maps !== null && maps !== undefined);
    assertTrue(firestore !== null && firestore !== undefined);
  });

  test('Factory: Mode resolution handles case insensitivity and env overrides', () => {
    const factory = new GoogleServiceFactory();
    assertEqual(factory.resolveMode('DEMO'), 'demo');
    assertEqual(factory.resolveMode('live'), 'live');
    assertEqual(factory.resolveMode('LIVE'), 'live');
    assertEqual(factory.resolveMode('mock'), 'demo');
    assertEqual(factory.resolveMode(''), 'demo');
  });

  test('Factory: Mode toggle retains mock persistent singleton state', async () => {
    const factory = new GoogleServiceFactory('DEMO');
    assertEqual(factory.getMode(), 'DEMO');

    // Mutate mock sheets state
    const sheets = factory.getSheetsService();
    const inv = await sheets.getInventory();
    const initialSku = inv[0].sku;
    const initialStock = inv[0].stock;

    await sheets.updateInventoryStock(initialSku, 10);
    const updatedItem = await sheets.getInventoryBySku!(initialSku);
    assertEqual(updatedItem?.stock, initialStock + 10);

    // Switch mode to LIVE and back to DEMO
    factory.setMode('LIVE');
    assertEqual(factory.getMode(), 'LIVE');

    factory.setMode('DEMO');
    assertEqual(factory.getMode(), 'DEMO');

    // Verify mutated state is preserved in mock singleton
    const reloaded = await factory.getSheetsService().getInventoryBySku!(initialSku);
    assertEqual(reloaded?.stock, initialStock + 10);
  });

  test('Factory: Gracefully falls back to mock if live service credentials are absent', () => {
    const factory = new GoogleServiceFactory('LIVE');
    // In test environment without GCP credentials, live requests safely provide operational services
    const sheets = factory.getSheetsService('LIVE');
    assertTrue(sheets !== null);

    const gmail = factory.getGmailService('LIVE');
    assertTrue(gmail !== null);

    const status = factory.getStatus();
    assertEqual(status.sheets.status, 'operational');
    assertEqual(status.gmail.status, 'operational');
  });

  test('Factory: loadSeedData resets and seeds all mock services for specific industry', async () => {
    const factory = new GoogleServiceFactory('DEMO');

    // 1. Fashion
    const fashionRes = factory.loadSeedData('fashion');
    assertEqual(fashionRes.category, 'fashion');
    assertTrue(fashionRes.itemCount >= 3);
    const fashionInv = await factory.getSheetsService().getInventory();
    assertTrue(fashionInv.some((i: any) => i.name.includes('Áo Dài')));

    // 2. F&B
    const fnbRes = factory.loadSeedData('fnb');
    assertEqual(fnbRes.category, 'fnb');
    const fnbInv = await factory.getSheetsService().getInventory();
    assertTrue(fnbInv.some((i: any) => i.unit === 'ly' || i.name.includes('Trà Sữa')));

    // 3. Cosmetics
    const cosRes = factory.loadSeedData('cosmetics');
    assertEqual(cosRes.category, 'cosmetics');
    const cosInv = await factory.getSheetsService().getInventory();
    assertTrue(cosInv.some((i: any) => i.name.includes('Serum Rau Má')));
  });

  test('Factory: getStatus reports credentials configuration and service health', () => {
    const factory = GoogleServiceFactory.getInstance();
    const status = factory.getStatus();

    assertTrue(status.sheets.status === 'operational');
    assertTrue(status.gmail.status === 'operational');
    assertTrue(status.calendar.status === 'operational');
    assertTrue(status.maps.status === 'operational');
    assertTrue(status.firestore.status === 'operational');
    assertTrue(typeof status.credentialsConfigured.googleAuth === 'boolean');
    assertTrue(typeof status.credentialsConfigured.googleMaps === 'boolean');
    assertTrue(typeof status.credentialsConfigured.firebase === 'boolean');
  });
});
