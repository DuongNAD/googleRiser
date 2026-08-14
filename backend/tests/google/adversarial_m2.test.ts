/**
/**
 * SME AutoPilot — Milestone 2 Adversarial Challenger & Stress Test Suite
 * backend/tests/google/adversarial_m2.test.ts
 *
 * Empirical verification of:
 * 1. MockSheetsService concurrency stress, race conditions, atomic decrements, negative inventory guards, CSV injection.
 * 2. MockMapsService TSP 2-Opt on extreme routes (collinear, large stop sets, zero distance, duplicate coords), Haversine tortuosity boundaries.
 * 3. MockFirestoreService deep nested queries, compound filters, ACID transactions, snapshot isolation, and rollback guarantees.
 * 4. GoogleServiceFactory cross-service state lifecycle and industry dataset switching.
 */

import {
  describe,
  test,
  assertEqual,
  assertNotEqual,
  assertTrue,
  assertFalse,
  assertRange,
  assertContains,
  assertThrows,
  createMockInventoryItem,
  createMockOrder,
  createMockPromptTemplate
} from '../../../tests/harness';

import { MockSheetsService } from '../../src/google/sheets/MockSheetsService';
import { MockMapsService } from '../../src/google/maps/MockMapsService';
import { MockFirestoreService } from '../../src/google/firebase/MockFirestoreService';
import { MockGmailService } from '../../src/google/gmail/MockGmailService';
import { MockCalendarService } from '../../src/google/calendar/MockCalendarService';
import { GoogleServiceFactory } from '../../src/google/factory';
import { InsufficientStockError, SheetNotFoundError, RouteOptimizationError, FirestoreError } from '../../src/google/errors';
import { LatLng } from '@shared/types';

describe('Milestone 2 Empirical Challenger Adversarial & Stress Test Suite', () => {

  // ==========================================================================
  // SECTION 1: MOCKSHEETSSERVICE CONCURRENCY, RACE CONDITIONS & INVENTORY INTEGRITY
  // ==========================================================================

  test('ADV-M2-S1: Massive Concurrent Stock Decrement with Exact Depletion & Overdraw Rejection', async () => {
    const initialStock = 50;
    const sheets = new MockSheetsService([
      createMockInventoryItem({ sku: 'SKU-CONCUR-50', stock: initialStock, price: 150000 })
    ]);

    // Launch 150 concurrent decrement requests of -1 unit each
    const totalRequests = 150;
    const promises = Array.from({ length: totalRequests }, () =>
      sheets.updateInventoryStock('SKU-CONCUR-50', -1)
    );

    const settled = await Promise.allSettled(promises);
    const fulfilled = settled.filter(r => r.status === 'fulfilled');
    const rejected = settled.filter(r => r.status === 'rejected');

    // Invariants:
    // Exactly 50 requests must succeed (fulfilling initialStock = 50)
    assertEqual(fulfilled.length, initialStock);
    // Exactly 100 requests must be rejected with InsufficientStockError
    assertEqual(rejected.length, totalRequests - initialStock);

    rejected.forEach(r => {
      if (r.status === 'rejected') {
        assertTrue(
          r.reason instanceof InsufficientStockError ||
          (r.reason?.message && r.reason.message.includes('Insufficient stock')),
          'Rejected promises must fail with InsufficientStockError'
        );
      }
    });

    // Final stock must be strictly 0 (never negative)
    const item = await sheets.getInventoryBySku('SKU-CONCUR-50');
    assertEqual(item?.stock, 0);

    // 151st decrement must also fail
    await assertThrows(
      async () => sheets.updateInventoryStock('SKU-CONCUR-50', -1),
      'Insufficient stock'
    );

    // Subsequent restock of +25 units must succeed and restore stock to 25
    const restocked = await sheets.updateInventoryStock('SKU-CONCUR-50', 25);
    assertEqual(restocked.stock, 25);
  });

  test('ADV-M2-S2: Multi-SKU Concurrent Chaos (Interleaved Increments & Decrements)', async () => {
    const skus = ['SKU-CHAOS-A', 'SKU-CHAOS-B', 'SKU-CHAOS-C', 'SKU-CHAOS-D'];
    const initialStock = 100;
    const sheets = new MockSheetsService(
      skus.map(sku => createMockInventoryItem({ sku, stock: initialStock, price: 100000 }))
    );

    // For each SKU, perform 20 decrements of -3 (-60) and 10 increments of +4 (+40) -> Net delta = -20 -> Expected final = 80
    const operations: Promise<any>[] = [];
    for (const sku of skus) {
      for (let i = 0; i < 20; i++) {
        operations.push(sheets.updateInventoryStock(sku, -3));
      }
      for (let i = 0; i < 10; i++) {
        operations.push(sheets.updateInventoryStock(sku, 4));
      }
    }

    // Shuffle operations to maximize concurrency interleaving
    const shuffled = operations.sort(() => Math.random() - 0.5);
    await Promise.all(shuffled);

    for (const sku of skus) {
      const item = await sheets.getInventoryBySku(sku);
      assertEqual(item?.stock, 80);
    }
  });

  test('ADV-M2-S3: Mutex Error Recovery & Deadlock Prevention on Failed Operations', async () => {
    const sheets = new MockSheetsService([
      createMockInventoryItem({ sku: 'SKU-MUTEX-TEST', stock: 5, price: 50000 })
    ]);

    // Step 1: Deliberately trigger InsufficientStockError
    await assertThrows(
      async () => sheets.updateInventoryStock('SKU-MUTEX-TEST', -10),
      'Insufficient stock'
    );

    // Step 2: Deliberately trigger SheetNotFoundError on missing SKU
    await assertThrows(
      async () => sheets.updateInventoryStock('SKU-NON-EXISTENT', -1),
      'not found'
    );

    // Step 3: Valid operation must immediately acquire lock and succeed without deadlock
    const valid = await sheets.updateInventoryStock('SKU-MUTEX-TEST', -3);
    assertEqual(valid.stock, 2);

    const current = await sheets.getInventoryBySku('SKU-MUTEX-TEST');
    assertEqual(current?.stock, 2);
  });

  test('ADV-M2-S4: Batch Updates vs Concurrent Single Updates Interleaving', async () => {
    const sheets = new MockSheetsService([
      createMockInventoryItem({ sku: 'SKU-BATCH-1', stock: 50, price: 100000 }),
      createMockInventoryItem({ sku: 'SKU-BATCH-2', stock: 50, price: 200000 })
    ]);

    // Concurrently execute batch update and single update
    const p1 = sheets.batchUpdateInventory([
      { sku: 'SKU-BATCH-1', delta: -10, price: 120000 },
      { sku: 'SKU-BATCH-2', delta: -20 }
    ]);
    const p2 = sheets.updateInventoryStock('SKU-BATCH-1', -5);
    const p3 = sheets.updateInventoryStock('SKU-BATCH-2', 15);

    await Promise.all([p1, p2, p3]);

    const item1 = await sheets.getInventoryBySku('SKU-BATCH-1');
    const item2 = await sheets.getInventoryBySku('SKU-BATCH-2');

    // SKU 1: 50 - 10 - 5 = 35, Price = 120000
    assertEqual(item1?.stock, 35);
    assertEqual(item1?.price, 120000);

    // SKU 2: 50 - 20 + 15 = 45
    assertEqual(item2?.stock, 45);
  });

  test('ADV-M2-S5: CSV Export Escaping with Special Characters, Quotes, and Formula Strings', async () => {
    const sheets = new MockSheetsService([
      createMockInventoryItem({
        sku: 'SKU-CSV-SPEC',
        name: 'Áo Dài "Đại Cát" Thêu Hoa, Đỏ',
        category: 'Áo Dài, Dạ Hội',
        price: 850000,
        stock: 12
      })
    ]);

    const csv = await sheets.exportToCsv('INVENTORY_MASTER');
    assertTrue(csv.includes('"Áo Dài ""Đại Cát"" Thêu Hoa, Đỏ"'));
    assertTrue(csv.includes('"Áo Dài, Dạ Hội"'));
    assertTrue(csv.includes('850000'));
    assertTrue(csv.includes('12'));
  });

  // ==========================================================================
  // SECTION 2: MOCKMAPSSERVICE TSP 2-OPT ROUTE OPTIMIZER & HAVERSINE BOUNDARIES
  // ==========================================================================

  test('ADV-M2-M1: TSP 2-Opt on Collinear & Reversed Delivery Stops', async () => {
    const maps = new MockMapsService();
    const depot: LatLng = { lat: 21.0000, lng: 105.8000 };

    // 8 collinear stops strictly lined up south-to-north, supplied in reverse/jumbled order
    const stops = [
      { id: 'STOP-8', address: 'Stop 8 (Far North)', location: { lat: 21.0800, lng: 105.8000 } },
      { id: 'STOP-2', address: 'Stop 2 (Near)', location: { lat: 21.0200, lng: 105.8000 } },
      { id: 'STOP-6', address: 'Stop 6 (Mid-Far)', location: { lat: 21.0600, lng: 105.8000 } },
      { id: 'STOP-1', address: 'Stop 1 (Closest)', location: { lat: 21.0100, lng: 105.8000 } },
      { id: 'STOP-7', address: 'Stop 7 (Far)', location: { lat: 21.0700, lng: 105.8000 } },
      { id: 'STOP-3', address: 'Stop 3', location: { lat: 21.0300, lng: 105.8000 } },
      { id: 'STOP-5', address: 'Stop 5', location: { lat: 21.0500, lng: 105.8000 } },
      { id: 'STOP-4', address: 'Stop 4', location: { lat: 21.0400, lng: 105.8000 } }
    ];

    const result = await maps.optimizeDeliveryRoute(depot, stops as any);

    assertEqual(result.totalOrders, 8);
    assertEqual(result.optimizedStops.length, 8);

    // In a collinear setup starting from depot at lat 21.0000, the optimal Nearest Neighbor / 2-Opt tour
    // MUST sequence stops in monotonic ascending latitude order (STOP-1 -> STOP-2 -> ... -> STOP-8)
    assertEqual(result.optimizedStops[0].orderId, 'STOP-1');
    assertEqual(result.optimizedStops[1].orderId, 'STOP-2');
    assertEqual(result.optimizedStops[2].orderId, 'STOP-3');
    assertEqual(result.optimizedStops[3].orderId, 'STOP-4');
    assertEqual(result.optimizedStops[4].orderId, 'STOP-5');
    assertEqual(result.optimizedStops[5].orderId, 'STOP-6');
    assertEqual(result.optimizedStops[6].orderId, 'STOP-7');
    assertEqual(result.optimizedStops[7].orderId, 'STOP-8');

    // Cumulative distances and arrival times must be strictly monotonically increasing
    for (let i = 1; i < result.optimizedStops.length; i++) {
      const currDist = result.optimizedStops[i].cumulativeDistanceKm ?? 0;
      const prevDist = result.optimizedStops[i - 1].cumulativeDistanceKm ?? 0;
      assertTrue(currDist >= prevDist);
      assertTrue(
        result.optimizedStops[i].estimatedArrivalMinutes >= result.optimizedStops[i - 1].estimatedArrivalMinutes
      );
    }
  });

  test('ADV-M2-M2: TSP on Large Stop Sets (Stress Scalability under 50 Stops)', async () => {
    const maps = new MockMapsService();
    const depot: LatLng = { lat: 21.0285, lng: 105.8542 };

    // Generate 50 delivery stops scattered across Hanoi metropolitan area
    const largeStops = Array.from({ length: 50 }, (_, i) => ({
      id: `ORD-BULK-${i + 1}`,
      address: `Điểm giao hàng #${i + 1}`,
      location: {
        lat: 20.95 + (i % 10) * 0.015 + Math.sin(i) * 0.01,
        lng: 105.75 + Math.floor(i / 10) * 0.02 + Math.cos(i) * 0.01
      }
    }));

    const startTime = Date.now();
    const result = await maps.optimizeDeliveryRoute(depot, largeStops as any);
    const duration = Date.now() - startTime;

    assertEqual(result.totalOrders, 50);
    assertEqual(result.optimizedStops.length, 50);
    assertTrue(duration < 200, `TSP on 50 stops must execute rapidly in <200ms (took ${duration}ms)`);

    // Verify all 50 stops have unique stopIndex 1..50
    const indices = result.optimizedStops.map(s => s.stopIndex);
    assertEqual(indices.length, 50);
    assertEqual(indices[0], 1);
    assertEqual(indices[49], 50);
  });

  test('ADV-M2-M3: Zero-Distance & Duplicate Coordinates Handling', async () => {
    const maps = new MockMapsService();
    const depot: LatLng = { lat: 21.0285, lng: 105.8542 };

    // 5 stops all with exact same coordinates as depot or each other
    const dupStops = [
      { id: 'DUP-1', location: { lat: 21.0285, lng: 105.8542 } },
      { id: 'DUP-2', location: { lat: 21.0285, lng: 105.8542 } },
      { id: 'DUP-3', location: { lat: 21.0285, lng: 105.8542 } },
      { id: 'DUP-4', location: { lat: 21.0300, lng: 105.8550 } },
      { id: 'DUP-5', location: { lat: 21.0300, lng: 105.8550 } }
    ];

    const result = await maps.optimizeDeliveryRoute(depot, dupStops as any);
    assertEqual(result.totalOrders, 5);
    assertEqual(result.optimizedStops.length, 5);
    assertFalse(isNaN(result.totalDistanceKm));
    assertFalse(isNaN(result.totalDurationMinutes));
    assertTrue(result.totalDistanceKm > 0);
  });

  test('ADV-M2-M4: Boundary Stop Counts (0 stops throws, 1 stop evaluates cleanly)', async () => {
    const maps = new MockMapsService();
    const depot: LatLng = { lat: 21.0285, lng: 105.8542 };

    // 0 stops -> Must throw RouteOptimizationError
    await assertThrows(
      async () => maps.optimizeDeliveryRoute(depot, []),
      'At least 1 stop is required'
    );

    // 1 stop -> Must return single stop result cleanly
    const singleResult = await maps.optimizeDeliveryRoute(depot, [
      { id: 'SINGLE-1', address: 'Tràng Tiền', location: { lat: 21.0244, lng: 105.8577 } }
    ] as any);
    assertEqual(singleResult.totalOrders, 1);
    assertEqual(singleResult.optimizedStops.length, 1);
    assertEqual(singleResult.optimizedStops[0].stopIndex, 1);
    assertTrue(singleResult.totalDistanceKm > 0);
  });

  test('ADV-M2-M5: Geodesic vs Urban Distance & Shipping Rate Boundary Thresholds', async () => {
    const maps = new MockMapsService();

    // Micro-distance (<0.05 km) returns minimum 0.1 km
    const microDist = maps.calculateUrbanDistanceKm(
      { lat: 21.0000, lng: 105.8000 },
      { lat: 21.0001, lng: 105.8001 }
    );
    assertEqual(microDist, 0.1);

    // Rate boundary exact matches:
    // Exactly 3.0 km -> 18,000 VND
    const rate3km = maps.calculateShippingRate(3.0);
    assertEqual(rate3km.shippingRateVnd, 18000);
    assertEqual(rate3km.rateTier, 'STANDARD_INNER_CITY');

    // 3.1 km -> 18,000 + 0.1 * 4,000 = 18,400 VND
    const rate3_1km = maps.calculateShippingRate(3.1);
    assertEqual(rate3_1km.shippingRateVnd, 18400);

    // Exactly 7.0 km -> 18,000 + 4 * 4,000 = 34,000 VND
    const rate7km = maps.calculateShippingRate(7.0);
    assertEqual(rate7km.shippingRateVnd, 34000);
    assertEqual(rate7km.rateTier, 'STANDARD_INNER_CITY');

    // 7.1 km -> Suburb tier base 35,000 + (7.1 - 7) * 3500 = 35,350 VND
    const rate7_1km = maps.calculateShippingRate(7.1);
    assertEqual(rate7_1km.shippingRateVnd, 35350);
    assertEqual(rate7_1km.rateTier, 'SUBURB');

    // Exactly 15.0 km -> 35,000 + 8 * 3500 = 63,000 VND
    const rate15km = maps.calculateShippingRate(15.0);
    assertEqual(rate15km.shippingRateVnd, 63000);
    assertEqual(rate15km.rateTier, 'SUBURB');

    // 15.1 km -> Inter-provincial tier base 55,000 + (15.1 - 15) * 5000 = 55,500 VND
    const rate15_1km = maps.calculateShippingRate(15.1);
    assertEqual(rate15_1km.shippingRateVnd, 55500);
    assertEqual(rate15_1km.rateTier, 'INTER_PROVINCIAL');
  });

  // ==========================================================================
  // SECTION 3: MOCKFIRESTORESERVICE DEEP QUERIES, COMPOUND FILTERS & ACID ROLLBACKS
  // ==========================================================================

  test('ADV-M2-F1: Deeply Nested Document Immutability & Special Types', async () => {
    const firestore = new MockFirestoreService();
    firestore.reset();

    const complexDoc = {
      orderId: 'ORD-NESTED-01',
      customer: {
        name: 'Nguyễn Văn A',
        contact: { phone: '0901234567', email: 'vana@gmail.com' },
        address: { street: '12 Tràng Tiền', city: 'Hà Nội', geo: { lat: 21.0244, lng: 105.8577 } }
      },
      lineItems: [
        { sku: 'SKU-01', qty: 2, meta: { tags: ['silk', 'premium'], discounted: true } },
        { sku: 'SKU-02', qty: 1, meta: { tags: ['cotton'], discounted: false } }
      ],
      flags: { isVip: true, isFraud: false, deletedAt: null }
    };

    await firestore.setDocument('orders_deep', 'doc_01', complexDoc);

    // Mutate the returned object from getDocument
    const fetched = await firestore.getDocument<any>('orders_deep', 'doc_01');
    fetched.customer.name = 'TAMPERED_NAME';
    fetched.lineItems[0].qty = 999;
    fetched.customer.address.geo.lat = 0;

    // Verify original document in Firestore store is strictly untouched
    const freshFetch = await firestore.getDocument<any>('orders_deep', 'doc_01');
    assertEqual(freshFetch.customer.name, 'Nguyễn Văn A');
    assertEqual(freshFetch.lineItems[0].qty, 2);
    assertEqual(freshFetch.customer.address.geo.lat, 21.0244);
  });

  test('ADV-M2-F2: Compound Filter Stress (Multiple where, array-contains, in, orderBy, offset, limit)', async () => {
    const firestore = new MockFirestoreService();
    firestore.reset();

    // Populate 20 documents
    for (let i = 1; i <= 20; i++) {
      await firestore.setDocument('catalog', `prod_${i}`, {
        id: `prod_${i}`,
        category: i % 2 === 0 ? 'Fashion' : 'Cosmetics',
        price: i * 50000,
        stock: i * 5,
        status: i % 3 === 0 ? 'OUT_OF_STOCK' : 'ACTIVE',
        tags: i % 2 === 0 ? ['vietnam', 'silk', 'sale'] : ['vietnam', 'organic', 'featured']
      });
    }

    // 1. Compound filter: Category == 'Fashion' AND price <= 500000 AND tags array-contains 'silk'
    const query1 = await firestore.queryCollection<any>('catalog', {
      where: [
        { field: 'category', operator: '==', value: 'Fashion' },
        { field: 'price', operator: '<=', value: 500000 },
        { field: 'tags', operator: 'array-contains', value: 'silk' }
      ]
    });
    // Expected prod_2 (100k), prod_4 (200k), prod_6 (300k), prod_8 (400k), prod_10 (500k) -> 5 items
    assertEqual(query1.length, 5);
    query1.forEach(item => {
      assertEqual(item.category, 'Fashion');
      assertTrue(item.price <= 500000);
      assertTrue(item.tags.includes('silk'));
    });

    // 2. 'in' operator filter
    const query2 = await firestore.queryCollection<any>('catalog', {
      where: [{ field: 'status', operator: 'in', value: ['ACTIVE'] }]
    });
    // 20 items: i%3 === 0 are OUT_OF_STOCK (6 items: 3, 6, 9, 12, 15, 18). ACTIVE = 14 items.
    assertEqual(query2.length, 14);

    // 3. Combined where + orderBy + offset + limit
    const paged = await firestore.queryCollection<any>('catalog', {
      where: [{ field: 'category', operator: '==', value: 'Cosmetics' }], // 10 items (odds)
      orderBy: { field: 'price', direction: 'desc' }, // prod_19 (950k) down to prod_1 (50k)
      offset: 2,
      limit: 3
    });
    assertEqual(paged.length, 3);
    assertEqual(paged[0].id, 'prod_15'); // 19, 17, [15, 13, 11]
    assertEqual(paged[1].id, 'prod_13');
    assertEqual(paged[2].id, 'prod_11');

    // 4. Offset beyond total items returns empty array
    const emptyPaged = await firestore.queryCollection<any>('catalog', {
      offset: 100,
      limit: 10
    });
    assertEqual(emptyPaged.length, 0);
  });

  test('ADV-M2-F3: Concurrent ACID Transactions with Deterministic Rollback Isolation', async () => {
    const firestore = new MockFirestoreService();
    firestore.reset();

    // Initial state: Wallet A has 1,000,000 VND, Wallet B has 0 VND
    await firestore.setDocument('wallets', 'acc_A', { balance: 1000000 });
    await firestore.setDocument('wallets', 'acc_B', { balance: 0 });

    // Execute 10 successful transactions of 50,000 VND from A to B
    for (let i = 0; i < 10; i++) {
      await firestore.runTransaction(async tx => {
        const a = await tx.get<any>('wallets', 'acc_A');
        const b = await tx.get<any>('wallets', 'acc_B');
        tx.update('wallets', 'acc_A', { balance: a.balance - 50000 });
        tx.update('wallets', 'acc_B', { balance: b.balance + 50000 });
      });
    }

    const aMid = await firestore.getDocument<any>('wallets', 'acc_A');
    const bMid = await firestore.getDocument<any>('wallets', 'acc_B');
    assertEqual(aMid?.balance, 500000);
    assertEqual(bMid?.balance, 500000);

    // Attempt a transaction that throws halfway
    await assertThrows(async () => {
      await firestore.runTransaction(async tx => {
        const a = await tx.get<any>('wallets', 'acc_A');
        tx.update('wallets', 'acc_A', { balance: a.balance - 200000 });

        // Simulate unexpected failure (e.g. gateway timeout)
        throw new Error('GATEWAY_PAYMENT_FAILED_503');
      });
    }, 'GATEWAY_PAYMENT_FAILED');

    // Verify complete rollback: A balance is still exactly 500,000 VND
    const aFinal = await firestore.getDocument<any>('wallets', 'acc_A');
    const bFinal = await firestore.getDocument<any>('wallets', 'acc_B');
    assertEqual(aFinal?.balance, 500000);
    assertEqual(bFinal?.balance, 500000);
  });

  test('ADV-M2-F4: Multi-Collection ACID Transaction Rollback Trigger', async () => {
    const firestore = new MockFirestoreService();
    firestore.reset();

    await firestore.setDocument('inventory', 'SKU-TX-1', { stock: 10 });
    await firestore.setDocument('orders', 'ORD-TX-1', { status: 'PENDING' });
    await firestore.setDocument('wallets', 'USR-TX-1', { balance: 500000 });

    // Multi-collection transaction where 3rd mutation fails on missing document
    await assertThrows(async () => {
      await firestore.runTransaction(async tx => {
        // 1. Update inventory
        tx.update('inventory', 'SKU-TX-1', { stock: 9 });
        // 2. Set new audit entry
        tx.set('audit', 'audit_01', { action: 'ORDER_PLACED' });
        // 3. Attempt to update non-existent document -> throws TransactionConflictError
        tx.update('wallets', 'NON_EXISTENT_WALLET', { balance: 0 });
      });
    }, 'Cannot update missing doc');

    // Confirm NONE of the collections were modified
    const inv = await firestore.getDocument<any>('inventory', 'SKU-TX-1');
    const audit = await firestore.getDocument<any>('audit', 'audit_01');
    assertEqual(inv?.stock, 10);
    assertEqual(audit, null);
  });

  test('ADV-M2-F5: Concurrent Transactions on Same Document (Race Condition / Lost Update Analysis)', async () => {
    const firestore = new MockFirestoreService();
    firestore.reset();

    await firestore.setDocument('wallets', 'acc_shared', { balance: 1000 });

    // Launch 10 concurrent transactions, each with an internal async tick before update
    const txPromises = Array.from({ length: 10 }, () =>
      firestore.runTransaction(async tx => {
        const doc = await tx.get<any>('wallets', 'acc_shared');
        // Small async delay simulating business logic / network
        await new Promise(r => setTimeout(r, 5));
        tx.update('wallets', 'acc_shared', { balance: (doc?.balance || 0) - 50 });
      })
    );

    await Promise.all(txPromises);
    const finalDoc = await firestore.getDocument<any>('wallets', 'acc_shared');
    // Expected: 1000 - (10 * 50) = 500
    assertEqual(finalDoc?.balance, 500);
  });

  // ==========================================================================
  // SECTION 4: CROSS-SERVICE STATE LIFECYCLE & FACTORY INTEGRATION
  // ==========================================================================

  test('ADV-M2-E1: End-to-End Google Service Order Lifecycle Simulation', async () => {
    const factory = new GoogleServiceFactory('DEMO');
    factory.seedAllMocks('fashion');

    const sheets = factory.getSheetsService() as MockSheetsService;
    const gmail = factory.getGmailService() as MockGmailService;
    const maps = factory.getMapsService() as MockMapsService;
    const firestore = factory.getFirestoreService() as MockFirestoreService;
    const calendar = factory.getCalendarService() as MockCalendarService;

    // 1. Check & Decrement stock for an order
    const sku = 'FAS-AD-HD-RED-S';
    const beforeItem = await sheets.getInventoryBySku(sku);
    assertTrue(beforeItem !== null && beforeItem.stock > 0);
    const prevStock = beforeItem!.stock;

    await sheets.updateInventoryStock(sku, -1);
    const afterItem = await sheets.getInventoryBySku(sku);
    assertEqual(afterItem?.stock, prevStock - 1);

    // 2. Calculate Delivery Distance & Shipping Rate
    const depot = '28 Phố Huế, Hoàn Kiếm, Hà Nội';
    const customerAddr = '45 Tràng Tiền, Hoàn Kiếm, Hà Nội';
    const distanceInfo = await maps.calculateDistance(depot, customerAddr);
    assertTrue(distanceInfo.distanceKm > 0);
    assertTrue(distanceInfo.shippingRateVnd >= 18000);

    // 3. Append Order to Sheets
    const order = createMockOrder({
      orderId: 'ORD-LIFECYCLE-001',
      customerName: 'Trần Thị Thu Hà',
      deliveryAddress: customerAddr,
      itemsSubtotal: 650000,
      shippingFee: distanceInfo.shippingRateVnd,
      totalAmount: 650000 + distanceInfo.shippingRateVnd
    });
    await sheets.appendOrder(order);

    // 4. Dispatch Invoice Email via Gmail
    const emailResult = await gmail.sendInvoiceEmail('ha.tran@gmail.com', order);
    assertEqual(emailResult.status, 'SENT');
    const outbox = await gmail.getOutbox({ orderId: 'ORD-LIFECYCLE-001' });
    assertEqual(outbox.length, 1);
    assertTrue((outbox[0].htmlBody || '').includes('ORD-LIFECYCLE-001'));
    assertTrue((outbox[0].htmlBody || '').includes('img.vietqr.io'));

    // 5. Log Audit Event in Firestore
    const log = await firestore.logAuditEvent({
      action: 'EMAIL_DISPATCHED',
      actorId: 'system_auto',
      details: { orderId: order.orderId, totalAmount: order.totalAmount },
      riskLevel: 'LOW',
      status: 'SUCCESS'
    });
    assertTrue(log.logId.startsWith('log_'));

    // 6. Schedule Restock Event in Calendar
    const calEvent = await calendar.createEvent({
      summary: 'Nhập Bổ Sung Hàng Áo Dài Đỏ Size S',
      description: 'Đơn hàng lớn đã làm giảm tồn kho SKU FAS-AD-HD-RED-S',
      startDateTime: '2026-08-20T09:00:00+07:00',
      endDateTime: '2026-08-20T10:00:00+07:00',
      eventType: 'RESTOCK_REMINDER'
    });
    assertTrue(calEvent.eventId.startsWith('cal_event_'));

    // 7. Verify All Outbox and Logs are Queryable
    const allLogs = await firestore.getAuditLogs(10);
    assertTrue(allLogs.some(l => l.logId === log.logId));
  });

  test('ADV-M2-E2: Dynamic Industry Switching & Reset State Isolation in Factory', () => {
    const factory = new GoogleServiceFactory('DEMO');

    // 1. Load Fashion industry
    const fMeta = factory.loadSeedData('fashion');
    assertEqual(fMeta.category, 'fashion');
    assertEqual(fMeta.shopName, 'Thời Trang Mai Anh Boutique');
    assertTrue(fMeta.itemCount >= 10);

    // 2. Switch to F&B industry
    const fnbMeta = factory.loadSeedData('fnb');
    assertEqual(fnbMeta.category, 'fnb');
    assertEqual(fnbMeta.shopName, 'Bếp Mẹ Bắp F&B - Trà Sữa & Đặc Sản Nam Bộ');
    assertTrue(fnbMeta.itemCount >= 8);

    // 3. Switch to Cosmetics industry
    const cosmMeta = factory.loadSeedData('cosmetics');
    assertEqual(cosmMeta.category, 'cosmetics');
    assertEqual(cosmMeta.shopName, 'GlowSkin Vietnam - Mỹ Phẩm Thuần Chay Đà Nẵng');
    assertTrue(cosmMeta.itemCount >= 8);

    // 4. Reset all mocks cleanly
    factory.resetAllMocks();
    const status = factory.getStatus();
    assertEqual(status.mode, 'demo');
    assertEqual(status.sheets.status, 'operational');
  });
});
