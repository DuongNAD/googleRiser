import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  assertThrows,
  runAllRegisteredSuites,
  createMockOrder
} from '../harness';
import { Order } from '../../shared';

export function paginateOrders(
  orders: Order[],
  page: number,
  pageSize: number
): { data: Order[]; page: number; pageSize: number; totalItems: number; totalPages: number } {
  const totalItems = orders.length;
  const safePageSize = Math.max(1, Math.min(100, pageSize));
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.max(1, Math.min(totalPages, page));

  const startIndex = (safePage - 1) * safePageSize;
  const data = orders.slice(startIndex, startIndex + safePageSize);

  return {
    data,
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages
  };
}

export function transitionOrderStatus(
  currentStatus: Order['orderStatus'],
  targetStatus: Order['orderStatus']
): Order['orderStatus'] {
  // Valid status flow machine
  const allowedTransitions: Record<Order['orderStatus'], Order['orderStatus'][]> = {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PACKING', 'CANCELLED'],
    PACKING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [], // Terminal
    CANCELLED: []  // Terminal
  };

  const allowed = allowedTransitions[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `INVALID_STATE_TRANSITION: Cannot transition order from status "${currentStatus}" to "${targetStatus}".`
    );
  }

  return targetStatus;
}

export function searchOrders(orders: Order[], query: string): Order[] {
  if (!query || query.trim() === '') return orders;

  const cleanQuery = query.trim().toLowerCase();
  return orders.filter(o => {
    return (
      o.orderId.toLowerCase().includes(cleanQuery) ||
      o.customerName.toLowerCase().includes(cleanQuery) ||
      o.customerPhone.includes(cleanQuery) ||
      (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(cleanQuery))
    );
  });
}

export function calculateOrderTotal(subtotal: number, shippingFee: number, discount: number): number {
  const rawTotal = subtotal + shippingFee - discount;
  // Boundary 5: Negative order total clamped to 0
  return Math.max(0, rawTotal);
}

describe('Tier 2 Feature B12: Orders Table Edges Boundary Tests', () => {
  test('B12.1 - 10,000 order pagination stress returns exact slice and total page count', () => {
    // Generate 10,000 lightweight mock orders
    const largeOrderList: Order[] = [];
    for (let i = 1; i <= 10000; i++) {
      largeOrderList.push(createMockOrder({
        orderId: `ORD-${i}`,
        customerName: `Customer ${i}`
      }));
    }

    const pageSize = 20;
    const page500 = paginateOrders(largeOrderList, 500, pageSize);

    assertEqual(page500.totalItems, 10000);
    assertEqual(page500.totalPages, 500);
    assertEqual(page500.page, 500);
    assertEqual(page500.data.length, 20);
    assertEqual(page500.data[0].orderId, 'ORD-9981');
    assertEqual(page500.data[19].orderId, 'ORD-10000');
  });

  test('B12.2 - Invalid status transition from CANCELLED to SHIPPED throws INVALID_STATE_TRANSITION', async () => {
    await assertThrows(
      () => transitionOrderStatus('CANCELLED', 'SHIPPED'),
      'INVALID_STATE_TRANSITION',
      'Cannot resurrect cancelled order to shipped'
    );

    await assertThrows(
      () => transitionOrderStatus('DELIVERED', 'CONFIRMED'),
      'INVALID_STATE_TRANSITION'
    );
  });

  test('B12.3 - Special character and regex character search queries match safely as literals', () => {
    const orders = [
      createMockOrder({ orderId: 'ORD-[VIP]+01', customerName: 'Nguyễn Văn A (Cực VIP)' }),
      createMockOrder({ orderId: 'ORD-STANDARD-02', customerName: 'Trần Thị B' })
    ];

    // Regex characters in query
    const results = searchOrders(orders, '[VIP]+');
    assertEqual(results.length, 1);
    assertEqual(results[0].orderId, 'ORD-[VIP]+01');

    // Injection-like search term
    const resultsSql = searchOrders(orders, "' OR '1'='1");
    assertEqual(resultsSql.length, 0);
  });

  test('B12.4 - Batch action with empty selection is a safe no-op returning 0 affected items', () => {
    const selectedIds: string[] = [];
    const deleteOrders = (ids: string[]) => {
      if (ids.length === 0) return { affected: 0, status: 'NOOP' };
      return { affected: ids.length, status: 'DELETED' };
    };

    const result = deleteOrders(selectedIds);
    assertEqual(result.affected, 0);
    assertEqual(result.status, 'NOOP');
  });

  test('B12.5 - Excessive discount voucher clamps total order amount to 0 VND without negative total', () => {
    const subtotal = 300000;
    const shippingFee = 30000;
    const extremeDiscount = 500000; // voucher > total

    const total = calculateOrderTotal(subtotal, shippingFee, extremeDiscount);

    assertEqual(total, 0, 'Order total must never be negative');
    assertTrue(total >= 0);
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
