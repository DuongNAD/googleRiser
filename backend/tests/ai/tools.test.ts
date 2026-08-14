/**
 * Milestone 1 Unit Tests: Core Gemini Function Calling Tools
 * backend/tests/ai/tools.test.ts
 */

import {
  executeToolCall,
  queryInventory,
  calculateShippingFee,
  createDraftOrder,
  trackOrderStatus,
  applyDiscountVoucher,
  inventoryDB,
  ordersDB
} from '../../src/ai/tools';

export async function runToolsTests(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message || String(err) });
    }
  }

  function assert(condition: any, msg?: string) {
    if (!condition) throw new Error(msg || 'Assertion failed');
  }

  function assertEqual(actual: any, expected: any, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  // 1. query_inventory
  await test('Tools: query_inventory searches by SKU and name', async () => {
    const resBySku = await executeToolCall('query_inventory', { sku: 'AD-TET-01' });
    assertEqual(resBySku.found, true);
    assertEqual(resBySku.sku, 'AD-TET-01');
    assertEqual(resBySku.status, 'IN_STOCK');
    assert(resBySku.variations.length >= 2);

    const resByName = await executeToolCall('query_inventory', { productName: 'Serum Rau Má' });
    assertEqual(resByName.found, true);
    assertEqual(resByName.sku, 'SERUM-RAUMA-02');

    const resNotFound = await executeToolCall('query_inventory', { sku: 'NON_EXISTENT_SKU' });
    assertEqual(resNotFound.found, false);
  });

  // 2. calculate_shipping_fee
  await test('Tools: calculate_shipping_fee computes 63-province matrix correctly', async () => {
    // Hanoi intra-city: 15,000 VND standard
    const hanoi = await executeToolCall('calculate_shipping_fee', { province: 'Hà Nội' });
    assertEqual(hanoi.shippingFee, 15000);
    assertEqual(hanoi.currency, 'VND');

    // HCMC major city: 30,000 VND standard
    const hcm = await executeToolCall('calculate_shipping_fee', { province: 'Hồ Chí Minh' });
    assertEqual(hcm.shippingFee, 30000);

    // Other province: 35,000 VND standard
    const caMau = await executeToolCall('calculate_shipping_fee', { province: 'Cà Mau' });
    assertEqual(caMau.shippingFee, 35000);

    // Weight tiers (+5,000 per 500g above 500g)
    const heavyHanoi = await executeToolCall('calculate_shipping_fee', { province: 'Hà Nội', weightGram: 1500 });
    assertEqual(heavyHanoi.shippingFee, 25000); // 15000 + 2 * 5000

    // Express tier in Hanoi
    const expressHanoi = await executeToolCall('calculate_shipping_fee', { province: 'Hà Nội', shippingTier: 'express' });
    assertEqual(expressHanoi.shippingFee, 25000);
  });

  // 3. create_draft_order
  await test('Tools: create_draft_order validates Vietnamese phone and calculates subtotal/VietQR', async () => {
    const validOrder = await executeToolCall('create_draft_order', {
      customerName: 'Nguyễn Văn Nam',
      customerPhone: '0987654321',
      shippingAddress: {
        street: '456 Lê Duẩn',
        ward: 'Thạch Thang',
        district: 'Hải Châu',
        province: 'Đà Nẵng'
      },
      items: [
        { sku: 'AD-TET-01', productName: 'Áo Dài', quantity: 2, unitPrice: 589000 }
      ],
      paymentMethod: 'VIETQR_TRANSFER'
    });

    assertEqual(validOrder.success, true);
    assertEqual(validOrder.isPhoneValid, true);
    assertEqual(validOrder.subtotal, 1178000);
    assertEqual(validOrder.shippingFee, 0); // Free ship for subtotal >= 500k
    assertEqual(validOrder.finalAmount, 1178000);
    assert(validOrder.vietQrPayload !== undefined);
  });

  await test('Tools: create_draft_order flags invalid Vietnamese phone format', async () => {
    const invalidPhoneOrder = await executeToolCall('create_draft_order', {
      customerName: 'Test Customer',
      customerPhone: '123456', // Invalid phone
      shippingAddress: { street: '123 Test', province: 'Hà Nội' },
      items: [{ productName: 'Item', quantity: 1, unitPrice: 100000 }]
    });

    assertEqual(invalidPhoneOrder.isPhoneValid, false);
  });

  // 4. track_order_status
  await test('Tools: track_order_status looks up orders by phone or orderId', async () => {
    const trackByPhone = await executeToolCall('track_order_status', { customerPhone: '0912345678' });
    assertEqual(trackByPhone.found, true);
    assertEqual(trackByPhone.orderId, 'ORD-VN-20260814-001');
    assertEqual(trackByPhone.status, 'SHIPPED');

    const trackById = await executeToolCall('track_order_status', { orderId: 'ORD-VN-20260814-001' });
    assertEqual(trackById.found, true);

    const notFound = await executeToolCall('track_order_status', { orderId: 'ORD-NON-EXISTENT' });
    assertEqual(notFound.found, false);
  });

  // 5. apply_discount_voucher
  await test('Tools: apply_discount_voucher enforces rules for TET2026, FREESHIP, VIP50K, CHAOBANMOI', async () => {
    // TET2026: 20% max 50k for order >= 200k
    const tetVoucher = await executeToolCall('apply_discount_voucher', {
      voucherCode: 'TET2026',
      orderSubtotal: 589000
    });
    assertEqual(tetVoucher.isValid, true);
    assertEqual(tetVoucher.discountAmount, 50000); // Capped at 50k
    assertEqual(tetVoucher.finalTotal, 539000);

    // VIP50K: 50k fixed for order >= 400k
    const vipVoucher = await executeToolCall('apply_discount_voucher', {
      voucherCode: 'VIP50K',
      orderSubtotal: 500000
    });
    assertEqual(vipVoucher.isValid, true);
    assertEqual(vipVoucher.discountAmount, 50000);

    // FREESHIP: 30k for order >= 300k
    const freeship = await executeToolCall('apply_discount_voucher', {
      voucherCode: 'FREESHIP',
      orderSubtotal: 350000
    });
    assertEqual(freeship.isValid, true);
    assertEqual(freeship.discountAmount, 30000);

    // Rejection for order below minimum threshold
    const belowMin = await executeToolCall('apply_discount_voucher', {
      voucherCode: 'TET2026',
      orderSubtotal: 100000 // min is 200k
    });
    assertEqual(belowMin.isValid, false);
    assertEqual(belowMin.discountAmount, 0);

    // Invalid voucher code
    const invalidVoucher = await executeToolCall('apply_discount_voucher', {
      voucherCode: 'INVALID_CODE',
      orderSubtotal: 500000
    });
    assertEqual(invalidVoucher.isValid, false);
  });

  return results;
}
