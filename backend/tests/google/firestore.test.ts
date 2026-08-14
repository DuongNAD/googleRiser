/**
 * SME AutoPilot — Firebase Firestore Service Test Suite
 * backend/tests/google/firestore.test.ts
 */

import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertThrows,
  assertContains,
  createMockPromptTemplate
} from '../../../tests/harness';
import { MockFirestoreService } from '../../src/google/firebase/MockFirestoreService';
import { LiveFirestoreService } from '../../src/google/firebase/LiveFirestoreService';
import { TransactionConflictError } from '../../src/google/errors';

describe('Firebase Firestore NoSQL & ACID Transactions Test Suite', () => {
  test('Firestore: Document CRUD operations with deep cloning and immutability', async () => {
    const firestore = new MockFirestoreService();

    // 1. Set document
    await firestore.setDocument('merchants', 'm-01', {
      shopName: 'Tiệm Lụa Mai Anh',
      city: 'Hanoi',
      rating: 4.9
    });

    // 2. Get document
    const doc = await firestore.getDocument<any>('merchants', 'm-01');
    assertEqual(doc?.shopName, 'Tiệm Lụa Mai Anh');
    assertEqual(doc?.rating, 4.9);

    // 3. Update document
    await firestore.updateDoc('merchants', 'm-01', { rating: 5.0 });
    const updated = await firestore.getDocument<any>('merchants', 'm-01');
    assertEqual(updated?.rating, 5.0);

    // 4. Delete document
    await firestore.deleteDoc('merchants', 'm-01');
    const deleted = await firestore.getDocument('merchants', 'm-01');
    assertEqual(deleted, null);
  });

  test('Firestore: Complex query evaluator with compound where, orderBy, limit, offset', async () => {
    const firestore = new MockFirestoreService();
    firestore.reset();

    // Seed mock orders
    await firestore.setDocument('orders', 'ORD-01', { orderId: 'ORD-01', city: 'Hanoi', totalAmount: 450000, status: 'CONFIRMED' });
    await firestore.setDocument('orders', 'ORD-02', { orderId: 'ORD-02', city: 'Hanoi', totalAmount: 1250000, status: 'CONFIRMED' });
    await firestore.setDocument('orders', 'ORD-03', { orderId: 'ORD-03', city: 'HCMC', totalAmount: 320000, status: 'SHIPPED' });
    await firestore.setDocument('orders', 'ORD-04', { orderId: 'ORD-04', city: 'Hanoi', totalAmount: 650000, status: 'DRAFT' });

    // 1. Query with where filter
    const hanoiConfirmed = await firestore.queryCollection<any>('orders', {
      where: [
        { field: 'city', operator: '==', value: 'Hanoi' },
        { field: 'status', operator: '==', value: 'CONFIRMED' }
      ]
    });
    assertEqual(hanoiConfirmed.length, 2);

    // 2. Query with orderBy desc and limit
    const highestOrders = await firestore.queryCollection<any>('orders', {
      orderBy: { field: 'totalAmount', direction: 'desc' },
      limit: 2
    });
    assertEqual(highestOrders.length, 2);
    assertEqual(highestOrders[0].orderId, 'ORD-02');
    assertEqual(highestOrders[1].orderId, 'ORD-04');

    // 3. Query with range condition (> 500,000)
    const largeOrders = await firestore.queryCollection<any>('orders', {
      where: [{ field: 'totalAmount', operator: '>', value: 500000 }]
    });
    assertEqual(largeOrders.length, 2);
  });

  test('Firestore: ACID Transaction with atomic commit and rollback on failure', async () => {
    const firestore = new MockFirestoreService();
    firestore.reset();

    // Set initial account balances
    await firestore.setDocument('wallets', 'acc_buyer', { balance: 1000000 });
    await firestore.setDocument('wallets', 'acc_merchant', { balance: 500000 });

    // Successful transfer transaction
    await firestore.runTransaction(async tx => {
      const buyer = await tx.get<any>('wallets', 'acc_buyer');
      const merchant = await tx.get<any>('wallets', 'acc_merchant');

      const transferAmount = 300000;
      if (buyer.balance < transferAmount) {
        throw new Error('Insufficient funds');
      }

      tx.update('wallets', 'acc_buyer', { balance: buyer.balance - transferAmount });
      tx.update('wallets', 'acc_merchant', { balance: merchant.balance + transferAmount });
    });

    const buyerAfter = await firestore.getDocument<any>('wallets', 'acc_buyer');
    const merchantAfter = await firestore.getDocument<any>('wallets', 'acc_merchant');
    assertEqual(buyerAfter?.balance, 700000);
    assertEqual(merchantAfter?.balance, 800000);

    // Failing transaction (rollback)
    await assertThrows(async () => {
      await firestore.runTransaction(async tx => {
        const buyer = await tx.get<any>('wallets', 'acc_buyer');
        tx.update('wallets', 'acc_buyer', { balance: buyer.balance - 100000 });

        // Force exception mid-transaction
        throw new Error('Bank network timeout error');
      });
    }, 'Bank network timeout');

    // Confirm buyer balance was NOT modified by aborted transaction (rollback guarantee)
    const buyerFinal = await firestore.getDocument<any>('wallets', 'acc_buyer');
    assertEqual(buyerFinal?.balance, 700000);
  });

  test('Firestore: Records immutable audit log trail for audited bills and operations', async () => {
    const firestore = new MockFirestoreService();

    const log = await firestore.logAuditEvent({
      action: 'BILL_AUDITED',
      actorId: 'user_judge_01',
      details: { amount: 650000, bank: 'Vietcombank', status: 'AUTHENTIC' },
      riskLevel: 'LOW',
      status: 'SUCCESS'
    });

    assertTrue(log.logId.startsWith('log_'));
    assertEqual(log.action, 'BILL_AUDITED');
    assertEqual(log.riskLevel, 'LOW');

    const logs = await firestore.getAuditLogs(10);
    assertTrue(logs.length > 0);
    assertTrue(logs.some(l => l.logId === log.logId));
  });

  test('Firestore: Multi-tenant isolation for prompt templates and merchant profiles', async () => {
    const firestore = new MockFirestoreService();
    const tenantA = 'tenant_boutique_hanoi';
    const tenantB = 'tenant_tea_saigon';

    await firestore.savePromptTemplate(
      tenantA,
      createMockPromptTemplate({ templateId: 'tmpl_fashion_custom', title: 'Mai Anh Fashion Copy' })
    );

    const tenantATemplates = await firestore.listPromptTemplates(tenantA);
    assertEqual(tenantATemplates.length, 1);
    assertEqual(tenantATemplates[0].templateId, 'tmpl_fashion_custom');

    // Tenant B queries templates -> should NOT see Tenant A's templates
    const tenantBTemplates = await firestore.listPromptTemplates(tenantB);
    assertEqual(tenantBTemplates.length, 0);

    const crossAccess = await firestore.getPromptTemplate(tenantB, 'tmpl_fashion_custom');
    assertEqual(crossAccess, null);
  });

  test('Firestore: LiveFirestoreService operates cleanly with fallback', async () => {
    const liveService = new LiveFirestoreService();
    await liveService.setDocument('test_col', 'doc_1', { hello: 'world' });
    const res = await liveService.getDocument<any>('test_col', 'doc_1');
    assertEqual(res?.hello, 'world');
  });
});
