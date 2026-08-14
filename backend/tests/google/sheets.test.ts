/**
 * SME AutoPilot — Google Sheets Service Test Suite
 * backend/tests/google/sheets.test.ts
 */

import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertThrows,
  assertContains,
  createMockInventoryItem,
  createMockOrder
} from '../../../tests/harness';
import { MockSheetsService } from '../../src/google/sheets/MockSheetsService';
import { LiveSheetsService } from '../../src/google/sheets/LiveSheetsService';
import { InsufficientStockError } from '../../src/google/errors';

describe('Google Sheets Service & Formula Engine Test Suite', () => {
  test('Sheets: Fetches seed inventory catalog with Vietnamese product titles and prices', async () => {
    const service = new MockSheetsService();
    const inventory = await service.getInventory();

    assertTrue(inventory.length >= 10);
    const item = inventory.find(i => i.sku.includes('FAS-AD-HD-RED-S'));
    assertTrue(item !== undefined);
    assertEqual(item?.category, 'Áo Dài');
    assertEqual(item?.price, 650000);
    assertEqual(item?.unit, 'bộ');
  });

  test('Sheets: Atomic stock decrement and InsufficientStockError protection', async () => {
    const service = new MockSheetsService([
      createMockInventoryItem({ sku: 'SKU-STOCK-TEST', stock: 10, lowStockThreshold: 3 })
    ]);

    // Valid decrement (sale of 4 items)
    const updated = await service.updateInventoryStock('SKU-STOCK-TEST', -4);
    assertEqual(updated.stock, 6);

    // Valid restock (addition of 5 items)
    const restocked = await service.updateInventoryStock('SKU-STOCK-TEST', 5);
    assertEqual(restocked.stock, 11);

    // Negative stock attempt (-12 units when stock is 11)
    await assertThrows(
      async () => service.updateInventoryStock('SKU-STOCK-TEST', -12),
      'Insufficient stock'
    );

    // Ensure stock remained intact at 11
    const current = await service.getInventoryBySku('SKU-STOCK-TEST');
    assertEqual(current?.stock, 11);
  });

  test('Sheets: Formula evaluation for stock warning and order total calculation', async () => {
    const service = new MockSheetsService();

    // 1. Stock Status Formula: =IF(E2<=G2, "CẢNH BÁO", "ĐỦ HÀNG")
    const inStockItem = createMockInventoryItem({ stock: 20, lowStockThreshold: 5 });
    const lowStockItem = createMockInventoryItem({ stock: 3, lowStockThreshold: 5 });

    assertEqual(service.evaluateStockStatusFormula(inStockItem), 'ĐỦ HÀNG');
    assertEqual(service.evaluateStockStatusFormula(lowStockItem), 'CẢNH BÁO');

    // 2. Order Total Formula: =G2+H2-I2 (subtotal + shipping - discount)
    const order = createMockOrder({
      itemsSubtotal: 650000,
      shippingFee: 30000,
      discountAmount: 50000
    });
    assertEqual(service.evaluateOrderTotalFormula(order), 630000);
  });

  test('Sheets: Appends orders to journal with auto-calculated totals and duplicate guards', async () => {
    const service = new MockSheetsService([], []);
    const order = createMockOrder({
      orderId: 'ORD-TEST-001',
      itemsSubtotal: 450000,
      shippingFee: 20000,
      discountAmount: 20000,
      totalAmount: 450000
    });

    const saved = await service.appendOrder(order);
    assertEqual(saved.orderId, 'ORD-TEST-001');

    const all = await service.getOrders();
    assertEqual(all.length, 1);
    assertEqual(all[0].customerName, order.customerName);

    // Duplicate order prevention
    await assertThrows(
      async () => service.appendOrder(order),
      'already exists'
    );
  });

  test('Sheets: Batch updates inventory prices and stock levels atomically', async () => {
    const service = new MockSheetsService([
      createMockInventoryItem({ sku: 'SKU-A', stock: 10, price: 100000 }),
      createMockInventoryItem({ sku: 'SKU-B', stock: 20, price: 200000 })
    ]);

    const results = await service.batchUpdateInventory([
      { sku: 'SKU-A', delta: -2, price: 110000 },
      { sku: 'SKU-B', delta: 5 }
    ]);

    assertEqual(results.length, 2);
    assertEqual(results[0].stock, 8);
    assertEqual(results[0].price, 110000);
    assertEqual(results[1].stock, 25);
  });

  test('Sheets: Generates RFC 4180 CSV representation with Vietnamese column headers', async () => {
    const service = new MockSheetsService();
    const inventoryCsv = await service.exportToCsv('INVENTORY_MASTER');
    assertContains(inventoryCsv, 'Mã SKU');
    assertContains(inventoryCsv, 'Tên Sản Phẩm');
    assertContains(inventoryCsv, 'Đơn Giá (VND)');

    const ordersCsv = await service.exportToCsv('ORDERS_JOURNAL');
    assertContains(ordersCsv, 'Mã Đơn Hàng');
    assertContains(ordersCsv, 'Tên Khách Hàng');
  });

  test('Sheets: Bi-directional conflict reconciliation merges external sheet updates', async () => {
    const service = new MockSheetsService([
      createMockInventoryItem({ sku: 'SKU-SYNC-1', stock: 10, price: 100000 }),
      createMockInventoryItem({ sku: 'SKU-SYNC-2', stock: 5, price: 200000 })
    ]);

    const remoteUpdates = [
      createMockInventoryItem({ sku: 'SKU-SYNC-1', stock: 8, price: 100000 }),
      createMockInventoryItem({ sku: 'SKU-SYNC-2', stock: 5, price: 200000 }),
      createMockInventoryItem({ sku: 'SKU-SYNC-3', stock: 15, price: 300000 })
    ];

    const report = service.reconcile(remoteUpdates);
    assertEqual(report.updated, 1);
    assertEqual(report.added, 1);

    const fullCatalog = await service.getInventory();
    assertEqual(fullCatalog.length, 3);
    const item1 = fullCatalog.find(i => i.sku === 'SKU-SYNC-1');
    assertEqual(item1?.stock, 8);
  });

  test('Sheets: LiveSheetsService operates and syncs cleanly with fallback', async () => {
    const liveService = new LiveSheetsService();
    const inv = await liveService.getInventory();
    assertTrue(inv.length > 0);

    const metadata = await liveService.getSpreadsheetMetadata();
    assertTrue(metadata.sheets.length >= 2);
    assertEqual(metadata.sheets[0].title, 'INVENTORY_MASTER');
  });
});
