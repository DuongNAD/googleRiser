/**
 * SME AutoPilot — Core Gemini 2.0 Function Calling Tool Declarations & Execution Logic
 * backend/src/ai/tools.ts
 *
 * Implements the 5 core SME AutoPilot tools:
 * 1. query_inventory
 * 2. calculate_shipping_fee
 * 3. create_draft_order
 * 4. track_order_status
 * 5. apply_discount_voucher
 */

import { buildVietQRPayload } from './billForensics';

// ============================================================================
// 1. TOOL DECLARATIONS SCHEMA FOR GEMINI 2.0
// ============================================================================

export const toolDeclarations = [
  {
    name: 'query_inventory',
    description: 'Tra cứu tình trạng tồn kho, mức giá và các phân loại (size, màu) của sản phẩm theo mã SKU hoặc tên sản phẩm.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sku: {
          type: 'STRING',
          description: 'Mã SKU sản phẩm (ví dụ: AD-TET-01, SERUM-VN-02)'
        },
        productName: {
          type: 'STRING',
          description: 'Tên hoặc từ khóa tìm kiếm sản phẩm tiếng Việt (ví dụ: Áo Dài Cách Tân, Serum Rau Má)'
        },
        category: {
          type: 'STRING',
          description: 'Ngành hàng (Thời Trang, Mỹ Phẩm, Thực Phẩm)'
        },
        variation: {
          type: 'OBJECT',
          description: 'Phân loại cần tìm (ví dụ: {"size": "M", "color": "Đỏ"})'
        }
      }
    }
  },
  {
    name: 'calculate_shipping_fee',
    description: 'Tính toán phí vận chuyển chính xác đến 63 tỉnh thành Việt Nam dựa trên địa chỉ và trọng lượng đơn hàng.',
    parameters: {
      type: 'OBJECT',
      properties: {
        province: {
          type: 'STRING',
          description: 'Tên Tỉnh/Thành phố nhận hàng (ví dụ: Hà Nội, Hồ Chí Minh, Đà Nẵng, Cần Thơ)'
        },
        district: {
          type: 'STRING',
          description: 'Tên Quận/Huyện nhận hàng (ví dụ: Quận Cầu Giấy, Quận 1, Quận Hải Châu)'
        },
        weightGram: {
          type: 'NUMBER',
          description: 'Khối lượng gói hàng tính bằng gram (mặc định 500g)'
        },
        shippingTier: {
          type: 'STRING',
          enum: ['standard', 'express', 'same_day'],
          description: 'Gói vận chuyển: standard (Tiêu chuẩn 2-3 ngày), express (Nhanh 24h), same_day (Hỏa tốc 2-4h)'
        }
      },
      required: ['province']
    }
  },
  {
    name: 'create_draft_order',
    description: 'Tạo đơn hàng nháp hoàn chỉnh với thông tin khách hàng, số điện thoại, địa chỉ nhận hàng, danh sách sản phẩm và phương thức thanh toán.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerName: {
          type: 'STRING',
          description: 'Họ và tên khách hàng nhận hàng'
        },
        customerPhone: {
          type: 'STRING',
          description: 'Số điện thoại khách hàng (10 chữ số chuẩn Việt Nam, ví dụ: 0912345678)'
        },
        shippingAddress: {
          type: 'OBJECT',
          properties: {
            street: { type: 'STRING', description: 'Số nhà, tên đường' },
            ward: { type: 'STRING', description: 'Phường/Xã' },
            district: { type: 'STRING', description: 'Quận/Huyện' },
            province: { type: 'STRING', description: 'Tỉnh/Thành phố' }
          },
          required: ['street', 'province']
        },
        items: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              sku: { type: 'STRING' },
              productName: { type: 'STRING' },
              quantity: { type: 'NUMBER' },
              unitPrice: { type: 'NUMBER' },
              variation: { type: 'OBJECT' }
            },
            required: ['productName', 'quantity', 'unitPrice']
          }
        },
        notes: {
          type: 'STRING',
          description: 'Ghi chú giao hàng (ví dụ: giao giờ hành chính, gọi trước khi giao)'
        },
        paymentMethod: {
          type: 'STRING',
          enum: ['COD', 'VIETQR_TRANSFER', 'MOMO'],
          description: 'Hình thức thanh toán: COD (Thu hộ), VIETQR_TRANSFER (Chuyển khoản VietQR), MOMO'
        }
      },
      required: ['customerName', 'customerPhone', 'shippingAddress', 'items']
    }
  },
  {
    name: 'track_order_status',
    description: 'Tra cứu tiến độ giao hàng và trạng thái đơn hàng của khách hàng theo mã đơn hàng hoặc số điện thoại.',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderId: {
          type: 'STRING',
          description: 'Mã đơn hàng (ví dụ: ORD-VN-20260814-001)'
        },
        customerPhone: {
          type: 'STRING',
          description: 'Số điện thoại đặt hàng của khách hàng'
        }
      }
    }
  },
  {
    name: 'apply_discount_voucher',
    description: 'Kiểm tra tính hợp lệ của mã khuyến mãi (voucher) và tính toán số tiền được giảm trừ cho đơn hàng.',
    parameters: {
      type: 'OBJECT',
      properties: {
        voucherCode: {
          type: 'STRING',
          description: 'Mã voucher (ví dụ: TET2026, FREESHIP, VIP50K, CHAOBANMOI, AIRISER2026)'
        },
        orderSubtotal: {
          type: 'NUMBER',
          description: 'Tổng giá trị tiền hàng trước giảm giá (VND)'
        },
        customerTier: {
          type: 'STRING',
          enum: ['NEW', 'REGULAR', 'VIP'],
          description: 'Hạng khách hàng'
        }
      },
      required: ['voucherCode', 'orderSubtotal']
    }
  }
];

export const GEMINI_TOOLS_DECLARATIONS = [{ functionDeclarations: toolDeclarations }];

// ============================================================================
// 2. IN-MEMORY STORE FOR STATEFUL MOCK/EXECUTION
// ============================================================================

export interface InventoryItemState {
  sku: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  originalPrice: number;
  variations: Array<{ size?: string; color?: string; stock: number }>;
}

export const initialInventory: InventoryItemState[] = [
  {
    sku: 'AD-TET-01',
    name: 'Áo Dài Cách Tân Tơ Tằm',
    category: 'Thời Trang Nữ',
    stock: 45,
    price: 589000,
    originalPrice: 850000,
    variations: [
      { size: 'S', color: 'Đỏ Ruby', stock: 15 },
      { size: 'M', color: 'Đỏ Ruby', stock: 18 },
      { size: 'L', color: 'Đỏ Ruby', stock: 12 },
      { size: 'M', color: 'Vàng Cúc', stock: 10 }
    ]
  },
  {
    sku: 'SERUM-RAUMA-02',
    name: 'Serum Rau Má Phục Hồi Da Mụn An Nhiên',
    category: 'Mỹ Phẩm',
    stock: 120,
    price: 245000,
    originalPrice: 350000,
    variations: [
      { size: '30ml', stock: 80 },
      { size: '50ml', stock: 40 }
    ]
  },
  {
    sku: 'CAFE-ROBUSTA-03',
    name: 'Cà Phê Robusta Mộc Đắk Lắk Hảo Hạng',
    category: 'Thực Phẩm & Đồ Uống',
    stock: 85,
    price: 135000,
    originalPrice: 180000,
    variations: [
      { size: '500g', stock: 50 },
      { size: '1kg', stock: 35 }
    ]
  }
];

export const inventoryDB: InventoryItemState[] = [...initialInventory];

export const ordersDB: Map<string, any> = new Map([
  [
    'ORD-VN-20260814-001',
    {
      orderId: 'ORD-VN-20260814-001',
      customerName: 'Nguyễn Thị Mai',
      customerPhone: '0912345678',
      shippingAddress: '123 Đường Cầu Giấy, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội',
      items: [{ sku: 'AD-TET-01', productName: 'Áo Dài Cách Tân Tơ Tằm (Size M)', quantity: 1, unitPrice: 589000 }],
      totalAmount: 589000,
      paymentMethod: 'COD',
      status: 'SHIPPED',
      statusText: 'Đang giao hàng (Shipper GHTK)',
      trackingCode: 'GHTK-HN-9823471',
      carrier: 'Giao Hàng Tiết Kiệm',
      estimatedDelivery: '2026-08-14T17:00:00+07:00',
      createdAt: '2026-08-13T10:30:00+07:00'
    }
  ]
]);

// ============================================================================
// 3. INDIVIDUAL TOOL IMPLEMENTATIONS
// ============================================================================

export function queryInventory(args: {
  sku?: string;
  productName?: string;
  category?: string;
  variation?: Record<string, string>;
}): any {
  const { sku, productName, category } = args;
  const results = inventoryDB.filter(item => {
    if (sku && item.sku.toLowerCase() === sku.toLowerCase()) return true;
    if (productName && item.name.toLowerCase().includes(productName.toLowerCase())) return true;
    if (category && item.category.toLowerCase().includes(category.toLowerCase())) return true;
    return false;
  });

  if (results.length > 0) {
    const item = results[0];
    return {
      found: true,
      sku: item.sku,
      productName: item.name,
      category: item.category,
      price: item.price,
      originalPrice: item.originalPrice,
      totalStock: item.stock,
      status: item.stock > 10 ? 'IN_STOCK' : item.stock > 0 ? 'LOW_STOCK' : 'OUT_OF_STOCK',
      variations: item.variations
    };
  }

  return {
    found: false,
    message: `Không tìm thấy sản phẩm khớp với từ khóa "${productName || sku}".`,
    suggestedProducts: inventoryDB.map(i => ({ sku: i.sku, name: i.name, price: i.price }))
  };
}

export function calculateShippingFee(args: {
  province: string;
  district?: string;
  weightGram?: number;
  shippingTier?: 'standard' | 'express' | 'same_day';
}): any {
  const { province, weightGram = 500, shippingTier = 'standard' } = args;
  const normalizedProv = (province || '').trim().toLowerCase();

  const isHanoi = normalizedProv.includes('hà nội') || normalizedProv.includes('ha noi');
  const isMajorCity = ['hồ chí minh', 'hcm', 'sài gòn', 'đà nẵng', 'hải phòng', 'cần thơ'].some(city =>
    normalizedProv.includes(city)
  );

  let baseFee = 30000;
  let estimatedDays = '2-3 ngày';

  if (isHanoi) {
    baseFee = shippingTier === 'same_day' ? 35000 : shippingTier === 'express' ? 25000 : 15000;
    estimatedDays = shippingTier === 'same_day' ? '2-4 giờ' : 'Trong ngày / 24h';
  } else if (isMajorCity) {
    baseFee = shippingTier === 'express' ? 45000 : 30000;
    estimatedDays = shippingTier === 'express' ? '24-36 giờ' : '2 ngày';
  } else {
    baseFee = 35000;
    estimatedDays = '3-4 ngày';
  }

  // Add 5,000 VND per additional 500g above 500g
  if (weightGram > 500) {
    const extraWeight = weightGram - 500;
    const extraBlocks = Math.ceil(extraWeight / 500);
    baseFee += extraBlocks * 5000;
  }

  return {
    province,
    weightGram,
    shippingTier,
    shippingFee: baseFee,
    currency: 'VND',
    estimatedDeliveryTime: estimatedDays,
    carrierPartners: ['GHTK', 'GHN', 'Viettel Post', 'GrabExpress']
  };
}

export function normalizeVietnamesePhone(input: string): string {
  if (!input) return '';
  let text = input.toLowerCase().trim();

  // Normalize international +84 phrases
  text = text.replace(/cộng\s+tám\s+(tư|bốn|tu|bon)/gi, '+84');
  text = text.replace(/cong\s+tam\s+(tu|bon|tư|bốn)/gi, '+84');
  text = text.replace(/plus\s+eight\s+four/gi, '+84');
  text = text.replace(/cộng\s+/gi, '+');
  text = text.replace(/cong\s+/gi, '+');
  text = text.replace(/plus\s+/gi, '+');

  const wordMap: Record<string, string> = {
    'không': '0', 'khong': '0', 'ko': '0', 'zero': '0',
    'một': '1', 'mốt': '1', 'mot': '1', 'one': '1',
    'hai': '2', 'two': '2',
    'ba': '3', 'three': '3',
    'bốn': '4', 'tư': '4', 'bon': '4', 'tu': '4', 'four': '4',
    'năm': '5', 'lăm': '5', 'nam': '5', 'lam': '5', 'five': '5',
    'sáu': '6', 'sau': '6', 'six': '6',
    'bảy': '7', 'bẩy': '7', 'bay': '7', 'seven': '7',
    'tám': '8', 'tam': '8', 'eight': '8',
    'chín': '9', 'chin': '9', 'nine': '9'
  };

  const tokens = text.split(/[\s,._\-()]+/);
  const transformed = tokens.map(t => wordMap[t] !== undefined ? wordMap[t] : t).join('');

  // Remove any remaining unwanted characters except '+' and digits
  const cleaned = transformed.replace(/[^\d+]/g, '');
  return cleaned;
}

export function createDraftOrder(args: {
  customerName: string;
  customerPhone: string;
  shippingAddress: { street: string; ward?: string; district?: string; province: string };
  items: Array<{ sku?: string; productName: string; quantity: number; unitPrice: number; variation?: any }>;
  notes?: string;
  paymentMethod?: 'COD' | 'VIETQR_TRANSFER' | 'MOMO';
}): any {
  const { customerName, customerPhone, shippingAddress, items = [], notes = '', paymentMethod = 'COD' } = args;

  // Validate Vietnamese mobile phone number (03|05|07|08|09 or +84)
  const phoneClean = normalizeVietnamesePhone(customerPhone || '');
  const vnPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
  const isPhoneValid = vnPhoneRegex.test(phoneClean);

  const subtotal = items.reduce((sum: number, it: any) => sum + it.unitPrice * (it.quantity || 1), 0);
  const shippingFee = subtotal >= 500000 ? 0 : 30000;
  const finalAmount = subtotal + shippingFee;

  const orderId = `ORD-VN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  let vietQrPayload: string | undefined = undefined;
  if (paymentMethod === 'VIETQR_TRANSFER') {
    vietQrPayload = buildVietQRPayload({
      bankBin: '970422', // MB Bank
      accountNumber: '0912345678',
      amount: finalAmount,
      transferContent: `THANH TOAN ${orderId}`
    });
  }

  const newOrder = {
    orderId,
    customerName,
    customerPhone: phoneClean || customerPhone,
    isPhoneValid,
    shippingAddress: `${shippingAddress.street || ''}, ${shippingAddress.ward || ''}, ${shippingAddress.district || ''}, ${shippingAddress.province || ''}`,
    items,
    subtotal,
    shippingFee,
    finalAmount,
    notes,
    paymentMethod,
    status: 'PENDING_CONFIRMATION',
    vietQrPayload,
    createdAt: new Date().toISOString()
  };

  ordersDB.set(orderId, newOrder);

  return {
    success: true,
    orderId,
    customerName,
    customerPhone: phoneClean || customerPhone,
    itemCount: items.length,
    subtotal,
    shippingFee,
    finalAmount,
    paymentMethod,
    isPhoneValid,
    vietQrPayload,
    message: 'Đơn hàng nháp đã được khởi tạo thành công!'
  };
}

export function trackOrderStatus(args: { orderId?: string; customerPhone?: string }): any {
  const { orderId, customerPhone } = args;
  let matchedOrder: any = null;

  if (orderId && ordersDB.has(orderId)) {
    matchedOrder = ordersDB.get(orderId);
  } else if (customerPhone) {
    const cleanPhone = customerPhone.replace(/\s+/g, '');
    for (const ord of ordersDB.values()) {
      if (ord.customerPhone && ord.customerPhone.includes(cleanPhone)) {
        matchedOrder = ord;
        break;
      }
    }
  }

  if (matchedOrder) {
    return {
      found: true,
      orderId: matchedOrder.orderId,
      status: matchedOrder.status,
      statusText: matchedOrder.statusText || 'Đang xử lý đóng gói',
      carrier: matchedOrder.carrier || 'GHTK',
      trackingCode: matchedOrder.trackingCode || 'GHTK-VN-0001',
      estimatedDelivery: matchedOrder.estimatedDelivery || 'Trong vòng 24-48h tới',
      totalAmount: matchedOrder.finalAmount || matchedOrder.totalAmount
    };
  }

  return {
    found: false,
    message: `Không tìm thấy đơn hàng tương ứng với thông tin tra cứu (${orderId || customerPhone}).`
  };
}

export function applyDiscountVoucher(args: {
  voucherCode: string;
  orderSubtotal: number;
  customerTier?: 'NEW' | 'REGULAR' | 'VIP';
}): any {
  const { voucherCode, orderSubtotal = 0 } = args;
  const code = (voucherCode || '').trim().toUpperCase();

  const voucherRules: Record<
    string,
    { minOrder: number; discount: number; type: 'FIXED' | 'PERCENT'; maxDiscount?: number; desc: string }
  > = {
    TET2026: { minOrder: 200000, discount: 20, type: 'PERCENT', maxDiscount: 50000, desc: 'Giảm 20% tối đa 50k cho đơn từ 200k' },
    FREESHIP: { minOrder: 300000, discount: 30000, type: 'FIXED', desc: 'Miễn phí vận chuyển 30k cho đơn từ 300k' },
    VIP50K: { minOrder: 400000, discount: 50000, type: 'FIXED', desc: 'Giảm trực tiếp 50k cho khách hàng thân thiết' },
    CHAOBANMOI: { minOrder: 100000, discount: 15000, type: 'FIXED', desc: 'Giảm 15k cho khách hàng mới đặt lần đầu' },
    AIRISER2026: { minOrder: 500000, discount: 100000, type: 'FIXED', desc: 'Ưu đãi đặc biệt AI Riser Vietnam 100k' }
  };

  const rule = voucherRules[code];
  if (!rule) {
    return {
      isValid: false,
      voucherCode: code,
      discountAmount: 0,
      finalTotal: orderSubtotal,
      message: `Mã giảm giá "${code}" không tồn tại hoặc đã hết lượt sử dụng.`
    };
  }

  if (orderSubtotal < rule.minOrder) {
    return {
      isValid: false,
      voucherCode: code,
      discountAmount: 0,
      finalTotal: orderSubtotal,
      message: `Đơn hàng chưa đạt giá trị tối thiểu ${rule.minOrder.toLocaleString('vi-VN')}đ để áp dụng mã "${code}".`
    };
  }

  let discountAmount = 0;
  if (rule.type === 'PERCENT') {
    discountAmount = Math.min((orderSubtotal * rule.discount) / 100, rule.maxDiscount || Infinity);
  } else {
    discountAmount = rule.discount;
  }

  const finalTotal = Math.max(0, orderSubtotal - discountAmount);

  return {
    isValid: true,
    voucherCode: code,
    discountAmount,
    finalTotal,
    description: rule.desc,
    message: `Áp dụng thành công mã "${code}": giảm ${discountAmount.toLocaleString('vi-VN')}đ.`
  };
}

// ============================================================================
// 4. MAIN TOOL DISPATCHER
// ============================================================================

export async function executeToolCall(
  toolName: string,
  args: Record<string, any>,
  context?: any
): Promise<any> {
  switch (toolName) {
    case 'query_inventory':
      return queryInventory(args as any);
    case 'calculate_shipping_fee':
      return calculateShippingFee(args as any);
    case 'create_draft_order':
      return createDraftOrder(args as any);
    case 'track_order_status':
      return trackOrderStatus(args as any);
    case 'apply_discount_voucher':
      return applyDiscountVoucher(args as any);
    default:
      throw new Error(`Unknown tool name: ${toolName}`);
  }
}
