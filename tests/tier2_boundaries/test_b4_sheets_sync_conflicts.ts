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
  createMockInventoryItem
} from '../harness';
import { InventoryItem, Order, ISheetsService } from '../../shared';

export class MockSheetsServiceBoundary implements ISheetsService {
  private inventory: Map<string, InventoryItem> = new Map();
  private orders: Map<string, Order> = new Map();
  public defaultSpreadsheetId = '1SME_VN_AUTO_DEFAULT_SHEET_2026';

  constructor(initialItems: InventoryItem[] = [], initialOrders: Order[] = []) {
    for (const item of initialItems) {
      this.inventory.set(item.sku, { ...item });
    }
    for (const order of initialOrders) {
      this.orders.set(order.orderId, { ...order });
    }
  }

  async getInventory(spreadsheetId?: string): Promise<InventoryItem[]> {
    const targetSheet = this.resolveSpreadsheetId(spreadsheetId);
    return Array.from(this.inventory.values());
  }

  async updateInventoryStock(sku: string, delta: number, spreadsheetId?: string): Promise<InventoryItem> {
    this.resolveSpreadsheetId(spreadsheetId);

    // Boundary 5: Non-existent SKU
    const item = this.inventory.get(sku);
    if (!item) {
      throw new Error(`ITEM_NOT_FOUND: SKU "${sku}" does not exist in spreadsheet inventory.`);
    }

    // Boundary 2: Zero stock decrement
    if (delta === 0) {
      return { ...item };
    }

    // Boundary 1: Negative inventory delta exceeding available stock
    const newStock = item.stock + delta;
    if (newStock < 0) {
      throw new Error(`INSUFFICIENT_STOCK_ERROR: Cannot decrement stock by ${Math.abs(delta)}. Current stock: ${item.stock}`);
    }

    item.stock = newStock;
    item.lastUpdated = new Date().toISOString();
    this.inventory.set(sku, item);
    return { ...item };
  }

  async getOrders(spreadsheetId?: string): Promise<Order[]> {
    this.resolveSpreadsheetId(spreadsheetId);
    return Array.from(this.orders.values());
  }

  async appendOrder(order: Order, spreadsheetId?: string): Promise<Order> {
    this.resolveSpreadsheetId(spreadsheetId);

    // Boundary 3: Simultaneous order sync deduplication
    if (this.orders.has(order.orderId)) {
      // Deduplicate atomically, return existing without adding duplicate row
      return this.orders.get(order.orderId)!;
    }

    this.orders.set(order.orderId, { ...order });
    return order;
  }

  async syncAll(spreadsheetId?: string): Promise<{ inventoryCount: number; ordersCount: number }> {
    this.resolveSpreadsheetId(spreadsheetId);
    return {
      inventoryCount: this.inventory.size,
      ordersCount: this.orders.size
    };
  }

  // Boundary 4: Empty spreadsheet ID fallback
  public resolveSpreadsheetId(spreadsheetId?: string): string {
    if (!spreadsheetId || spreadsheetId.trim() === '') {
      return this.defaultSpreadsheetId;
    }
    return spreadsheetId.trim();
  }
}

describe('Tier 2 Feature B4: Sheets Sync Conflicts Boundary Tests', () => {
  test('B4.1 - Negative inventory delta exceeding available stock throws INSUFFICIENT_STOCK_ERROR', async () => {
    const service = new MockSheetsServiceBoundary([
      createMockInventoryItem({ sku: 'SKU-LIMITED-01', stock: 5 })
    ]);

    await assertThrows(
      () => service.updateInventoryStock('SKU-LIMITED-01', -10),
      'INSUFFICIENT_STOCK_ERROR',
      'Should throw error when stock would become negative'
    );

    const items = await service.getInventory();
    assertEqual(items[0].stock, 5, 'Stock should remain unchanged after rejected transaction');
  });

  test('B4.2 - Zero stock delta is an idempotent no-op returning item unchanged', async () => {
    const initialItem = createMockInventoryItem({ sku: 'SKU-STATIC-01', stock: 20 });
    const service = new MockSheetsServiceBoundary([initialItem]);

    const updated = await service.updateInventoryStock('SKU-STATIC-01', 0);

    assertEqual(updated.stock, 20);
    assertEqual(updated.sku, 'SKU-STATIC-01');
  });

  test('B4.3 - Simultaneous order sync deduplicates identical order IDs cleanly', async () => {
    const service = new MockSheetsServiceBoundary();
    const order = createMockOrder({ orderId: 'ORD-DUP-001', totalAmount: 450000 });

    // Simulate 3 concurrent sync calls with same order ID
    const [res1, res2, res3] = await Promise.all([
      service.appendOrder(order),
      service.appendOrder(order),
      service.appendOrder(order)
    ]);

    assertEqual(res1.orderId, 'ORD-DUP-001');
    assertEqual(res2.orderId, 'ORD-DUP-001');
    assertEqual(res3.orderId, 'ORD-DUP-001');

    const orders = await service.getOrders();
    assertEqual(orders.length, 1, 'Only 1 unique order row must exist after concurrent sync');
  });

  test('B4.4 - Empty spreadsheet ID falls back to default tenant master spreadsheet ID', () => {
    const service = new MockSheetsServiceBoundary();

    const resolvedEmpty = service.resolveSpreadsheetId('');
    const resolvedUndefined = service.resolveSpreadsheetId(undefined);
    const resolvedSpaces = service.resolveSpreadsheetId('   ');

    assertEqual(resolvedEmpty, service.defaultSpreadsheetId);
    assertEqual(resolvedUndefined, service.defaultSpreadsheetId);
    assertEqual(resolvedSpaces, service.defaultSpreadsheetId);
  });

  test('B4.5 - Non-existent SKU update throws ITEM_NOT_FOUND error', async () => {
    const service = new MockSheetsServiceBoundary([
      createMockInventoryItem({ sku: 'SKU-EXISTING-01', stock: 10 })
    ]);

    await assertThrows(
      () => service.updateInventoryStock('SKU-GHOST-999', -1),
      'ITEM_NOT_FOUND',
      'Should throw error when SKU is not found'
    );
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
