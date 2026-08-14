import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  assertRange,
  createMockOrder,
  createMockInventoryItem
} from '../harness';
import { VoiceToolCall, VoiceToolResult, Order, InventoryItem } from '../../shared';

export function classifyVietnameseIntent(utterance: string): string {
  const text = utterance.toLowerCase();
  if (/còn\s+(hàng|áo|váy|size|màu)|kiểm\s+tra\s+kho|check\s+kho|hết\s+chưa/i.test(text)) {
    return 'INVENTORY_QUERY';
  }
  if (/ship|phí\s+giao|vận\s+chuyển|tiền\s+ship|giao\s+về/i.test(text)) {
    return 'SHIPPING_CALCULATION';
  }
  if (/đặt\s+(cho|hàng|mua|lấy)|chốt\s+(cho|đơn)|lấy\s+\d+|gửi\s+về\s+địa\s+chỉ/i.test(text)) {
    return 'ORDER_CREATION';
  }
  if (/mã\s+giảm|voucher|khuyến\s+mãi|coupon|chiết\s+khấu/i.test(text)) {
    return 'VOUCHER_APPLICATION';
  }
  if (/đơn\s+hàng\s+của\s+tôi|tra\s+cứu|đang\s+ở\s+đâu|mã\s+vận\s+đơn/i.test(text)) {
    return 'ORDER_TRACKING';
  }
  return 'GENERAL_FAQ';
}

export function executeQueryInventoryTool(
  skuOrName: string,
  inventoryDb: InventoryItem[]
): VoiceToolResult {
  const item = inventoryDb.find(
    i => i.sku.toLowerCase() === skuOrName.toLowerCase() || i.name.toLowerCase().includes(skuOrName.toLowerCase())
  );

  if (!item) {
    return {
      toolName: 'query_inventory',
      result: { available: false, message: `Không tìm thấy sản phẩm '${skuOrName}' trong kho.` }
    };
  }

  return {
    toolName: 'query_inventory',
    result: {
      available: item.stock > 0,
      sku: item.sku,
      name: item.name,
      stock: item.stock,
      price: item.price,
      status: item.stock > 5 ? 'IN_STOCK' : item.stock > 0 ? 'LOW_STOCK' : 'OUT_OF_STOCK'
    }
  };
}

export function executeCalculateShippingTool(
  city: string,
  district: string,
  orderValue: number
): VoiceToolResult {
  let baseFee = 30000;
  if (city.toLowerCase().includes('hà nội') || city.toLowerCase().includes('hcm') || city.toLowerCase().includes('hồ chí minh')) {
    baseFee = 25000;
  } else {
    baseFee = 40000;
  }

  // Free ship for orders >= 500,000 VND
  const isFreeShip = orderValue >= 500000;
  const finalFee = isFreeShip ? 0 : baseFee;

  return {
    toolName: 'calculate_shipping_fee',
    result: {
      city,
      district,
      baseFee,
      discountedFee: finalFee,
      isFreeShip,
      estimatedDeliveryDays: '1-2 ngày làm việc'
    }
  };
}

export function executeCreateDraftOrderTool(params: {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  city: string;
  items: { sku: string; name: string; quantity: number; unitPrice: number }[];
  shippingFee: number;
}): VoiceToolResult {
  const itemsSubtotal = params.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalAmount = itemsSubtotal + params.shippingFee;
  const orderId = `ORD-VOICE-${Date.now()}`;

  const order: Partial<Order> = {
    orderId,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    deliveryAddress: params.deliveryAddress,
    city: params.city,
    items: params.items.map(i => ({ ...i, subtotal: i.quantity * i.unitPrice })),
    itemsSubtotal,
    shippingFee: params.shippingFee,
    discountAmount: 0,
    totalAmount,
    paymentMethod: 'VIETQR_NAPAS',
    paymentStatus: 'PENDING',
    orderStatus: 'DRAFT'
  };

  return {
    toolName: 'create_draft_order',
    result: {
      success: true,
      draftOrder: order,
      message: `Đã tạo đơn hàng nháp ${orderId} thành công cho khách hàng ${params.customerName}.`
    }
  };
}

export function executeApplyVoucherTool(
  voucherCode: string,
  subtotal: number
): VoiceToolResult {
  const validVouchers: Record<string, { discountRate?: number; flatDiscount?: number; minOrder: number }> = {
    'FREESHIPVN': { flatDiscount: 30000, minOrder: 200000 },
    'AIRISER20': { discountRate: 0.20, minOrder: 300000 },
    'SME50K': { flatDiscount: 50000, minOrder: 400000 }
  };

  const config = validVouchers[voucherCode.toUpperCase()];
  if (!config) {
    return {
      toolName: 'apply_discount_voucher',
      result: { valid: false, message: `Mã giảm giá '${voucherCode}' không tồn tại hoặc đã hết hạn.` }
    };
  }

  if (subtotal < config.minOrder) {
    return {
      toolName: 'apply_discount_voucher',
      result: {
        valid: false,
        message: `Đơn hàng tối thiểu phải từ ${config.minOrder.toLocaleString('vi-VN')}đ để sử dụng mã này.`
      }
    };
  }

  const discountAmount = config.discountRate
    ? Math.round(subtotal * config.discountRate)
    : (config.flatDiscount || 0);

  const finalTotal = Math.max(0, subtotal - discountAmount);

  return {
    toolName: 'apply_discount_voucher',
    result: {
      valid: true,
      voucherCode: voucherCode.toUpperCase(),
      discountAmount,
      subtotal,
      finalTotal,
      message: `Áp dụng mã ${voucherCode} thành công! Giảm ${discountAmount.toLocaleString('vi-VN')}đ.`
    }
  };
}

describe('F3: Customer Voice & Chatbot Assistant (Function Calling)', () => {
  const mockInventory: InventoryItem[] = [
    createMockInventoryItem({ sku: 'AD-LUA-RED-L', name: 'Áo Dài Lụa Đỏ Size L', stock: 15, price: 450000 }),
    createMockInventoryItem({ sku: 'AD-GAM-YEL-M', name: 'Áo Dài Gấm Vàng Size M', stock: 2, price: 580000 }),
    createMockInventoryItem({ sku: 'TS-OOLONG-01', name: 'Trà Sữa Oolong Nướng', stock: 0, price: 45000 })
  ];

  test('Test 3.1: Natural Vietnamese conversational intent classification', () => {
    assertEqual(classifyVietnameseIntent('Shop ơi còn áo dài lụa đỏ size L không?'), 'INVENTORY_QUERY');
    assertEqual(classifyVietnameseIntent('Phí ship về Cầu Giấy Hà Nội hết bao nhiêu em?'), 'SHIPPING_CALCULATION');
    assertEqual(classifyVietnameseIntent('Chốt cho chị 2 bộ áo dài về số 18 Hàng Gai nhé'), 'ORDER_CREATION');
    assertEqual(classifyVietnameseIntent('Có mã giảm giá AIRISER20 nào áp dụng được không shop?'), 'VOUCHER_APPLICATION');
    assertEqual(classifyVietnameseIntent('Tra cứu giúp tôi mã vận đơn VNP12345'), 'ORDER_TRACKING');
  });

  test('Test 3.2: query_inventory tool call execution and stock thresholds', () => {
    // Normal stock item
    const res1 = executeQueryInventoryTool('Áo Dài Lụa Đỏ', mockInventory);
    assertTrue(res1.result.available);
    assertEqual(res1.result.stock, 15);
    assertEqual(res1.result.status, 'IN_STOCK');

    // Low stock item
    const res2 = executeQueryInventoryTool('AD-GAM-YEL-M', mockInventory);
    assertTrue(res2.result.available);
    assertEqual(res2.result.stock, 2);
    assertEqual(res2.result.status, 'LOW_STOCK');

    // Out of stock item
    const res3 = executeQueryInventoryTool('TS-OOLONG-01', mockInventory);
    assertFalse(res3.result.available);
    assertEqual(res3.result.status, 'OUT_OF_STOCK');
  });

  test('Test 3.3: calculate_shipping_fee tool call with tiered policies', () => {
    // Under 500k in Hanoi -> standard 25,000 VND
    const fee1 = executeCalculateShippingTool('Hà Nội', 'Quận Hoàn Kiếm', 350000);
    assertEqual(fee1.result.discountedFee, 25000);
    assertFalse(fee1.result.isFreeShip);

    // Over 500k in Hanoi -> Free shipping
    const fee2 = executeCalculateShippingTool('Hà Nội', 'Quận Cầu Giấy', 650000);
    assertEqual(fee2.result.discountedFee, 0);
    assertTrue(fee2.result.isFreeShip);

    // Inter-provincial (Da Nang) under 500k -> 40,000 VND
    const fee3 = executeCalculateShippingTool('Đà Nẵng', 'Quận Hải Châu', 200000);
    assertEqual(fee3.result.discountedFee, 40000);
  });

  test('Test 3.4: create_draft_order tool call payload validation', () => {
    const draftRes = executeCreateDraftOrderTool({
      customerName: 'Nguyễn Thu Trang',
      customerPhone: '0987654321',
      deliveryAddress: 'Số 12 Chùa Bộc, Đống Đa, Hà Nội',
      city: 'Hanoi',
      items: [{ sku: 'AD-LUA-RED-L', name: 'Áo Dài Lụa Đỏ Size L', quantity: 2, unitPrice: 450000 }],
      shippingFee: 25000
    });

    assertTrue(draftRes.result.success);
    const order = draftRes.result.draftOrder;
    assertEqual(order.customerName, 'Nguyễn Thu Trang');
    assertEqual(order.itemsSubtotal, 900000);
    assertEqual(order.shippingFee, 25000);
    assertEqual(order.totalAmount, 925000);
    assertEqual(order.orderStatus, 'DRAFT');
  });

  test('Test 3.5: apply_discount_voucher tool call and minimum spend logic', () => {
    // Valid voucher meeting min spend
    const voucherRes1 = executeApplyVoucherTool('AIRISER20', 500000);
    assertTrue(voucherRes1.result.valid);
    assertEqual(voucherRes1.result.discountAmount, 100000); // 20% of 500,000
    assertEqual(voucherRes1.result.finalTotal, 400000);

    // Voucher failing min spend condition
    const voucherRes2 = executeApplyVoucherTool('SME50K', 200000); // requires 400,000
    assertFalse(voucherRes2.result.valid);
    assertContains(voucherRes2.result.message, 'tối thiểu');

    // Non-existent voucher
    const voucherRes3 = executeApplyVoucherTool('INVALID_CODE', 500000);
    assertFalse(voucherRes3.result.valid);
  });
});
