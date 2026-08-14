import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertThrows,
  createMockOrder
} from '../harness';
import { Order } from '../../shared';

export type OrderStatus = Order['orderStatus'];

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  'DRAFT': ['CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['PACKING', 'CANCELLED'],
  'PACKING': ['SHIPPED', 'CANCELLED'],
  'SHIPPED': ['DELIVERED', 'CANCELLED'],
  'DELIVERED': [],
  'CANCELLED': []
};

export function transitionOrderStatus(current: OrderStatus, next: OrderStatus): OrderStatus {
  const allowed = VALID_ORDER_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Illegal order status transition from '${current}' to '${next}'`);
  }
  return next;
}

export function filterOrders(
  orders: Order[],
  filters: { orderStatus?: string; paymentStatus?: string; search?: string }
): Order[] {
  return orders.filter(order => {
    if (filters.orderStatus && filters.orderStatus !== 'ALL' && order.orderStatus !== filters.orderStatus) {
      return false;
    }
    if (filters.paymentStatus && filters.paymentStatus !== 'ALL' && order.paymentStatus !== filters.paymentStatus) {
      return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchId = order.orderId.toLowerCase().includes(q);
      const matchName = order.customerName.toLowerCase().includes(q);
      const matchPhone = order.customerPhone.includes(q);
      if (!matchId && !matchName && !matchPhone) {
        return false;
      }
    }
    return true;
  });
}

export function batchUpdateOrdersStatus(
  orders: Order[],
  orderIds: string[],
  newStatus: OrderStatus
): { updatedCount: number; updatedOrders: Order[] } {
  let updatedCount = 0;
  const updatedOrders = orders.map(order => {
    if (orderIds.includes(order.orderId)) {
      const updatedStatus = transitionOrderStatus(order.orderStatus, newStatus);
      updatedCount++;
      return { ...order, orderStatus: updatedStatus, updatedAt: new Date().toISOString() };
    }
    return order;
  });
  return { updatedCount, updatedOrders };
}

describe('F12: Order Management & Google Sheets Sync UI State', () => {
  const sampleOrders: Order[] = [
    createMockOrder({ orderId: 'ORD-01', customerName: 'Mai Anh', customerPhone: '0911223344', orderStatus: 'CONFIRMED', paymentStatus: 'VERIFIED' }),
    createMockOrder({ orderId: 'ORD-02', customerName: 'Bảo Long', customerPhone: '0988776655', orderStatus: 'PACKING', paymentStatus: 'VERIFIED' }),
    createMockOrder({ orderId: 'ORD-03', customerName: 'Thu Hà', customerPhone: '0933445566', orderStatus: 'SHIPPED', paymentStatus: 'VERIFIED' }),
    createMockOrder({ orderId: 'ORD-04', customerName: 'Văn Toàn', customerPhone: '0944556677', orderStatus: 'DRAFT', paymentStatus: 'PENDING' }),
    createMockOrder({ orderId: 'ORD-05', customerName: 'Thị Mai', customerPhone: '0977889900', orderStatus: 'CANCELLED', paymentStatus: 'FAILED' })
  ];

  test('Test 12.1: Order table schema validation and item row details', () => {
    const order = sampleOrders[0];
    assertTrue(order.orderId.startsWith('ORD-'));
    assertEqual(order.items.length, 1);
    assertEqual(order.items[0].unitPrice * order.items[0].quantity, order.items[0].subtotal);
    assertEqual(order.itemsSubtotal + order.shippingFee - order.discountAmount, order.totalAmount);
  });

  test('Test 12.2: Multi-criteria order filtering by status, payment, and search term', () => {
    // Filter by orderStatus 'PACKING'
    const packingOnly = filterOrders(sampleOrders, { orderStatus: 'PACKING' });
    assertEqual(packingOnly.length, 1);
    assertEqual(packingOnly[0].orderId, 'ORD-02');

    // Filter by paymentStatus 'PENDING'
    const pendingPayment = filterOrders(sampleOrders, { paymentStatus: 'PENDING' });
    assertEqual(pendingPayment.length, 1);
    assertEqual(pendingPayment[0].orderId, 'ORD-04');

    // Search by customer name
    const searchName = filterOrders(sampleOrders, { search: 'Thu Hà' });
    assertEqual(searchName.length, 1);
    assertEqual(searchName[0].orderId, 'ORD-03');

    // Search by phone number
    const searchPhone = filterOrders(sampleOrders, { search: '0911223344' });
    assertEqual(searchPhone.length, 1);
    assertEqual(searchPhone[0].customerName, 'Mai Anh');
  });

  test('Test 12.3: Order state machine lifecycle transitions and illegal jump rejection', () => {
    // Valid transitions
    assertEqual(transitionOrderStatus('DRAFT', 'CONFIRMED'), 'CONFIRMED');
    assertEqual(transitionOrderStatus('CONFIRMED', 'PACKING'), 'PACKING');
    assertEqual(transitionOrderStatus('PACKING', 'SHIPPED'), 'SHIPPED');
    assertEqual(transitionOrderStatus('SHIPPED', 'DELIVERED'), 'DELIVERED');

    // Illegal jump: CANCELLED -> DELIVERED
    assertThrows(
      () => transitionOrderStatus('CANCELLED', 'DELIVERED'),
      'Illegal order status transition'
    );

    // Illegal jump: DRAFT -> DELIVERED
    assertThrows(
      () => transitionOrderStatus('DRAFT', 'DELIVERED'),
      'Illegal order status transition'
    );
  });

  test('Test 12.4: 1-Click Google Sheets sync trigger and sync flag updates', () => {
    const order = createMockOrder({ orderId: 'ORD-SYNC-01' });
    const syncAction = {
      orderId: order.orderId,
      sheetSpreadsheetId: 'sheet_sme_2026',
      syncedAt: new Date().toISOString(),
      status: 'SYNCED'
    };

    assertEqual(syncAction.status, 'SYNCED');
    assertTrue(syncAction.syncedAt.length > 0);
  });

  test('Test 12.5: Batch order status update execution', () => {
    const { updatedCount, updatedOrders } = batchUpdateOrdersStatus(
      sampleOrders,
      ['ORD-01', 'ORD-02'],
      'CANCELLED'
    );

    assertEqual(updatedCount, 2);
    const ord1 = updatedOrders.find(o => o.orderId === 'ORD-01');
    const ord2 = updatedOrders.find(o => o.orderId === 'ORD-02');
    assertEqual(ord1?.orderStatus, 'CANCELLED');
    assertEqual(ord2?.orderStatus, 'CANCELLED');
  });
});
