import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertThrows,
  createMockInventoryItem,
  createMockOrder
} from '../harness';
import { InventoryItem, Order, ISheetsService } from '../../shared';

export class MockSheetsService implements ISheetsService {
  private inventoryStore: Map<string, InventoryItem> = new Map();
  private orderStore: Map<string, Order> = new Map();

  constructor(initialInventory: InventoryItem[] = [], initialOrders: Order[] = []) {
    initialInventory.forEach(item => this.inventoryStore.set(item.sku, { ...item }));
    initialOrders.forEach(order => this.orderStore.set(order.orderId, { ...order }));
  }

  async getInventory(spreadsheetId?: string): Promise<InventoryItem[]> {
    return Array.from(this.inventoryStore.values());
  }

  async updateInventoryStock(sku: string, delta: number, spreadsheetId?: string): Promise<InventoryItem> {
    const item = this.inventoryStore.get(sku);
    if (!item) {
      throw new Error(`SKU ${sku} not found in inventory sheet`);
    }

    if (item.stock + delta < 0) {
      throw new Error(`Insufficient stock for SKU ${sku}. Current: ${item.stock}, Delta: ${delta}`);
    }

    item.stock += delta;
    item.lastUpdated = new Date().toISOString();
    this.inventoryStore.set(sku, item);
    return { ...item };
  }

  async getOrders(spreadsheetId?: string): Promise<Order[]> {
    return Array.from(this.orderStore.values());
  }

  async appendOrder(order: Order, spreadsheetId?: string): Promise<Order> {
    if (this.orderStore.has(order.orderId)) {
      throw new Error(`Order ID ${order.orderId} already exists in Sheet`);
    }
    const savedOrder = { ...order, updatedAt: new Date().toISOString() };
    this.orderStore.set(order.orderId, savedOrder);
    return savedOrder;
  }

  async syncAll(spreadsheetId?: string): Promise<{ inventoryCount: number; ordersCount: number }> {
    return {
      inventoryCount: this.inventoryStore.size,
      ordersCount: this.orderStore.size
    };
  }

  // Reconciliation helper
  reconcile(remoteInventory: InventoryItem[]): { updated: number; added: number } {
    let updated = 0;
    let added = 0;

    for (const remote of remoteInventory) {
      if (this.inventoryStore.has(remote.sku)) {
        const local = this.inventoryStore.get(remote.sku)!;
        if (local.stock !== remote.stock || local.price !== remote.price) {
          this.inventoryStore.set(remote.sku, { ...remote });
          updated++;
        }
      } else {
        this.inventoryStore.set(remote.sku, { ...remote });
        added++;
      }
    }

    return { updated, added };
  }
}

describe('F4: Google Sheets Bi-Directional Synchronization', () => {
  test('Test 4.1: Inventory master fetch and column schema mapping', async () => {
    const service = new MockSheetsService([
      createMockInventoryItem({ sku: 'AD-01', name: 'Áo Dài Lụa Đỏ', stock: 20, price: 450000 }),
      createMockInventoryItem({ sku: 'VM-02', name: 'Váy Midi Linen', stock: 15, price: 380000 })
    ]);

    const inventory = await service.getInventory('spreadsheet_id_123');
    assertEqual(inventory.length, 2);
    assertEqual(inventory[0].sku, 'AD-01');
    assertEqual(inventory[0].price, 450000);
    assertEqual(inventory[1].sku, 'VM-02');
  });

  test('Test 4.2: Stock update delta and insufficient stock guard', async () => {
    const service = new MockSheetsService([
      createMockInventoryItem({ sku: 'AD-01', stock: 10 })
    ]);

    // Valid decrement (sale of 3 units)
    const updated = await service.updateInventoryStock('AD-01', -3);
    assertEqual(updated.stock, 7);

    // Valid increment (restock of 5 units)
    const restocked = await service.updateInventoryStock('AD-01', 5);
    assertEqual(restocked.stock, 12);

    // Negative stock violation attempt (-15 units when stock is 12)
    await assertThrows(
      async () => service.updateInventoryStock('AD-01', -15),
      'Insufficient stock'
    );
  });

  test('Test 4.3: Order journal row append and duplicate protection', async () => {
    const service = new MockSheetsService([], []);
    const order = createMockOrder({ orderId: 'ORD-SHEET-001', totalAmount: 450000 });

    const appended = await service.appendOrder(order);
    assertEqual(appended.orderId, 'ORD-SHEET-001');

    const allOrders = await service.getOrders();
    assertEqual(allOrders.length, 1);
    assertEqual(allOrders[0].customerName, order.customerName);

    // Prevent duplicate append
    await assertThrows(
      async () => service.appendOrder(order),
      'already exists'
    );
  });

  test('Test 4.4: Bi-directional conflict reconciliation between local and sheet', async () => {
    const service = new MockSheetsService([
      createMockInventoryItem({ sku: 'SKU-01', stock: 10, price: 100000 }),
      createMockInventoryItem({ sku: 'SKU-02', stock: 5, price: 200000 })
    ]);

    // Sheet has updated SKU-01 stock to 8 and added a new SKU-03
    const remoteSheetData: InventoryItem[] = [
      createMockInventoryItem({ sku: 'SKU-01', stock: 8, price: 100000 }),
      createMockInventoryItem({ sku: 'SKU-02', stock: 5, price: 200000 }),
      createMockInventoryItem({ sku: 'SKU-03', stock: 50, price: 150000 })
    ];

    const result = service.reconcile(remoteSheetData);
    assertEqual(result.updated, 1, '1 item updated');
    assertEqual(result.added, 1, '1 new item added');

    const updatedCatalog = await service.getInventory();
    assertEqual(updatedCatalog.length, 3);
    const item1 = updatedCatalog.find(i => i.sku === 'SKU-01');
    assertEqual(item1?.stock, 8);
  });

  test('Test 4.5: Batch sync all operations and sync metrics reporting', async () => {
    const service = new MockSheetsService(
      [
        createMockInventoryItem({ sku: 'ITM-1' }),
        createMockInventoryItem({ sku: 'ITM-2' }),
        createMockInventoryItem({ sku: 'ITM-3' })
      ],
      [
        createMockOrder({ orderId: 'ORD-1' }),
        createMockOrder({ orderId: 'ORD-2' })
      ]
    );

    const syncReport = await service.syncAll();
    assertEqual(syncReport.inventoryCount, 3);
    assertEqual(syncReport.ordersCount, 2);
  });
});
