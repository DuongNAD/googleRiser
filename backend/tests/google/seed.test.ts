/**
 * SME AutoPilot — Vietnamese SME Seed Data Loader Test Suite
 * backend/tests/google/seed.test.ts
 */

import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains
} from '../../../tests/harness';
import {
  getSeedData,
  getSeedInventory,
  getSeedOrders,
  getSeedShopProfile,
  getSeedCalendarEvents,
  getTestReceipts,
  getStoreBranches
} from '../../src/seed';

describe('Vietnamese SME Seed Datasets Test Suite', () => {
  test('Seed: Fashion Boutique ("Thời Trang Mai Anh Boutique") contains complete realistic dataset', () => {
    const profile = getSeedShopProfile('fashion');
    assertEqual(profile.shopName, 'Thời Trang Mai Anh Boutique');
    assertEqual(profile.city, 'Hanoi');
    assertEqual(profile.defaultBankBin, '970436'); // Vietcombank

    const inventory = getSeedInventory('fashion');
    assertTrue(inventory.length >= 10, 'Must have at least 10 fashion SKUs');
    assertTrue(inventory.some(i => i.name.includes('Áo Dài Lụa Hà Đông')));
    assertTrue(inventory.some(i => i.stock <= i.lowStockThreshold));

    const orders = getSeedOrders('fashion');
    assertTrue(orders.length >= 5, 'Must have at least 5 orders');
    assertTrue(orders.some(o => o.paymentMethod === 'VIETQR_NAPAS'));

    const events = getSeedCalendarEvents('fashion');
    assertTrue(events.length >= 2, 'Must have schedules');
    assertTrue(events.some(e => e.eventType === 'LIVESTREAM_SALES'));
  });

  test('Seed: F&B Specialty ("Bếp Mẹ Bắp F&B") contains complete realistic dataset', () => {
    const profile = getSeedShopProfile('fnb');
    assertEqual(profile.shopName, 'Bếp Mẹ Bắp F&B - Trà Sữa & Đặc Sản Nam Bộ');
    assertEqual(profile.city, 'Ho Chi Minh City');
    assertEqual(profile.defaultBankBin, '970422'); // MBBank

    const inventory = getSeedInventory('fnb');
    assertTrue(inventory.length >= 10, 'Must have at least 10 F&B items');
    assertTrue(inventory.some(i => i.unit === 'ly'));
    assertTrue(inventory.some(i => i.name.includes('Trà Sữa Oolong Nướng')));
    assertTrue(inventory.some(i => i.name.includes('Cơm Cháy Chà Bông')));
  });

  test('Seed: Cosmetics ("GlowSkin Vietnam") contains complete realistic dataset', () => {
    const profile = getSeedShopProfile('cosmetics');
    assertEqual(profile.shopName, 'GlowSkin Vietnam - Mỹ Phẩm Thuần Chay Đà Nẵng');
    assertEqual(profile.city, 'Da Nang');
    assertEqual(profile.defaultBankBin, '970407'); // Techcombank

    const inventory = getSeedInventory('cosmetics');
    assertTrue(inventory.length >= 10, 'Must have at least 10 cosmetic items');
    assertTrue(inventory.some(i => i.name.includes('Serum Rau Má')));
    assertTrue(inventory.some(i => i.name.includes('Kem Chống Nắng')));
  });

  test('Seed: Test receipts dataset contains authentic and manipulated samples for forensics testing', () => {
    const receipts = getTestReceipts();
    assertTrue(receipts.length >= 5, 'Must have at least 5 bank receipt samples');

    const authenticReceipts = receipts.filter(r => r.isAuthentic);
    const forgedReceipts = receipts.filter(r => !r.isAuthentic);

    assertTrue(authenticReceipts.length >= 3, 'Must have authentic bank slips');
    assertTrue(forgedReceipts.length >= 2, 'Must have forged/manipulated slips');

    // Check bank coverage (VCB, TCB, MB, Momo, BIDV, VPB)
    const bankCodes = receipts.map(r => r.bankCode);
    assertTrue(bankCodes.includes('VCB'));
    assertTrue(bankCodes.includes('TCB'));
    assertTrue(bankCodes.includes('MB'));
    assertTrue(bankCodes.includes('MOMO'));
    assertTrue(bankCodes.includes('BIDV'));
  });

  test('Seed: Store branches seed contains flagship locations in Hanoi, Da Nang, and HCMC', () => {
    const branches = getStoreBranches();
    assertEqual(branches.length, 3);

    const hanoi = branches.find(b => b.city === 'Hanoi');
    assertTrue(hanoi !== undefined && hanoi.isMainWarehouse);

    const daNang = branches.find(b => b.city === 'Da Nang');
    assertTrue(daNang !== undefined);

    const hcm = branches.find(b => b.city === 'Ho Chi Minh City');
    assertTrue(hcm !== undefined);
  });
});
