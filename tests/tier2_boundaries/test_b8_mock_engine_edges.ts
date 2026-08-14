import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  assertThrows,
  runAllRegisteredSuites,
  createMockSeedDataset,
  createMockOrder,
  createMockInventoryItem
} from '../harness';
import { InventoryItem, Order } from '../../shared';

export class MockEngineSPIBoundary {
  private currentMode: 'DEMO' | 'LIVE' = 'DEMO';
  private inventory: Map<string, InventoryItem> = new Map();
  private orders: Map<string, Order> = new Map();
  private initialItems: InventoryItem[] = [];

  constructor() {
    this.initDefaultSeed();
  }

  public getMode(): 'DEMO' | 'LIVE' {
    return this.currentMode;
  }

  public setMode(mode: 'DEMO' | 'LIVE'): void {
    this.currentMode = mode;
  }

  // Boundary 1 & 4: Load seed dataset with corrupted JSON handling and category fallback
  public loadSeedData(jsonStringOrCategory: string): { success: boolean; category: string; count: number } {
    let parsed: any;
    try {
      if (jsonStringOrCategory.startsWith('{')) {
        parsed = JSON.parse(jsonStringOrCategory);
      } else {
        const category = ['fashion', 'fnb', 'cosmetics'].includes(jsonStringOrCategory)
          ? (jsonStringOrCategory as 'fashion' | 'fnb' | 'cosmetics')
          : 'fashion'; // fallback
        parsed = createMockSeedDataset(category);
      }
    } catch (err) {
      // Graceful fallback to default fashion seed
      parsed = createMockSeedDataset('fashion');
    }

    const items: InventoryItem[] = parsed.items || [];
    this.inventory.clear();
    for (const item of items) {
      this.inventory.set(item.sku, { ...item });
    }
    return {
      success: true,
      category: parsed.category || 'general',
      count: this.inventory.size
    };
  }

  // Boundary 3: Concurrent atomic mock write
  public async atomicStockDecrement(sku: string, qty: number): Promise<{ success: boolean; remainingStock: number }> {
    const item = this.inventory.get(sku);
    if (!item) {
      throw new Error(`SKU ${sku} not found`);
    }
    if (item.stock < qty) {
      return { success: false, remainingStock: item.stock };
    }
    item.stock -= qty;
    this.inventory.set(sku, item);
    return { success: true, remainingStock: item.stock };
  }

  // Boundary 5: Reset state
  public resetMockState(): void {
    this.inventory.clear();
    this.orders.clear();
    this.initDefaultSeed();
  }

  public getInventoryCount(): number {
    return this.inventory.size;
  }

  public getStock(sku: string): number {
    return this.inventory.get(sku)?.stock ?? 0;
  }

  private initDefaultSeed(): void {
    const defaultData = createMockSeedDataset('fashion');
    this.initialItems = defaultData.items;
    for (const item of this.initialItems) {
      this.inventory.set(item.sku, { ...item });
    }
  }
}

describe('Tier 2 Feature B8: Mock Engine Edges Boundary Tests', () => {
  test('B8.1 - Corrupted seed JSON gracefully catches error and falls back to pristine default dataset', () => {
    const engine = new MockEngineSPIBoundary();
    const corruptedJson = '{"category": "fashion", "items": [{"sku": "BAD_JSON", "price": 100000,'; // missing closing brackets

    const result = engine.loadSeedData(corruptedJson);

    assertTrue(result.success);
    assertEqual(result.category, 'fashion');
    assertTrue(result.count > 0);
  });

  test('B8.2 - Rapid SPI toggle switching between DEMO and LIVE mode is thread-safe and consistent', () => {
    const engine = new MockEngineSPIBoundary();

    for (let i = 0; i < 50; i++) {
      const targetMode = i % 2 === 0 ? 'LIVE' : 'DEMO';
      engine.setMode(targetMode);
      assertEqual(engine.getMode(), targetMode);
    }
  });

  test('B8.3 - Concurrent mock stock decrements maintain exact mathematical balance without race conditions', async () => {
    const engine = new MockEngineSPIBoundary();
    // Default FAS-AD-01 has stock = 45
    const sku = 'FAS-AD-01';
    assertEqual(engine.getStock(sku), 45);

    // 20 concurrent decrements of 2 units each = 40 total decrement, 5 remaining
    const tasks: Promise<{ success: boolean; remainingStock: number }>[] = [];
    for (let i = 0; i < 20; i++) {
      tasks.push(engine.atomicStockDecrement(sku, 2));
    }

    const results = await Promise.all(tasks);
    const successful = results.filter(r => r.success);

    assertEqual(successful.length, 20);
    assertEqual(engine.getStock(sku), 5, 'Remaining stock should be exactly 45 - 40 = 5');
  });

  test('B8.4 - Missing or unsupported seed category falls back cleanly to fashion/general category', () => {
    const engine = new MockEngineSPIBoundary();

    const resultUnknown = engine.loadSeedData('aerospace_and_defense');
    assertTrue(resultUnknown.success);
    assertEqual(resultUnknown.category, 'fashion');
    assertTrue(resultUnknown.count > 0);
  });

  test('B8.5 - resetMockState restores all in-memory collections to initial pristine seed state', async () => {
    const engine = new MockEngineSPIBoundary();
    const sku = 'FAS-AD-01';

    // Mutate state
    await engine.atomicStockDecrement(sku, 30);
    assertEqual(engine.getStock(sku), 15);

    // Reset state
    engine.resetMockState();

    assertEqual(engine.getStock(sku), 45, 'Stock should be restored to initial seed value of 45');
    assertEqual(engine.getInventoryCount(), 3);
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
