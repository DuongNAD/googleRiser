import {
  BillForensicsResult,
  ProductMarketingPack,
  Order,
  InventoryItem,
  CalendarEvent,
  CalendarEventInput,
  TrackingInfo,
  SentEmailRecord,
  StoreBranch,
  LatLng,
  DistanceResult,
  RouteOptimizationResult,
  User,
  AuditLogEntry,
  PromptTemplate,
  ISheetsService,
  IGmailService,
  ICalendarService,
  IMapsService,
  RiskLevel,
  Recommendation,
  ApiResponse,
  HealthStatus,
  SSEEvent,
  VoiceToolCall,
  VoiceToolResult,
  VoiceAssistantTurn
} from '../../shared';
import {
  createMockInventoryItem,
  createMockOrder,
  createMockStoreBranch,
  createMockUser,
  createMockPromptTemplate,
  createMockSeedDataset,
  assertTrue
} from '../harness';

// ==========================================
// 1. VIETQR / FORENSICS HELPERS
// ==========================================
export interface ParsedVietQR {
  formatIndicator: string;
  initiationMethod: string;
  guid: string;
  bankBin: string;
  accountNumber: string;
  currency: string;
  amount?: number;
  memo?: string;
  crc: string;
}

export function parseEMVCoTLV(payload: string): Record<string, string> {
  const map: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.substring(i, i + 2);
    const len = parseInt(payload.substring(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > payload.length) break;
    const val = payload.substring(i + 4, i + 4 + len);
    map[tag] = val;
    i += 4 + len;
  }
  return map;
}

export function parseVietQRPayload(payload: string): ParsedVietQR {
  if (!payload || payload.length < 20) {
    throw new Error('Invalid VietQR payload: payload too short');
  }

  const rootTags = parseEMVCoTLV(payload);
  assertTrue(rootTags['00'] === '01', 'Tag 00 (Payload Format Indicator) must be 01');

  const tag38Value = rootTags['38'] || '';
  const tag38SubTags = parseEMVCoTLV(tag38Value);
  const guid = tag38SubTags['00'] || 'A000000727';

  const beneficiaryInfo = tag38SubTags['01'] || '';
  const beneficiarySubTags = parseEMVCoTLV(beneficiaryInfo);
  const bankBin = beneficiarySubTags['00'] || '970436';
  const accountNumber = beneficiarySubTags['01'] || '1029384756';

  const currency = rootTags['53'] === '704' ? 'VND' : (rootTags['53'] || 'UNKNOWN');
  const amountStr = rootTags['54'];
  const amount = amountStr ? parseInt(amountStr, 10) : undefined;
  const tag62Value = rootTags['62'] || '';
  const tag62SubTags = parseEMVCoTLV(tag62Value);
  const memo = tag62SubTags['08'] || undefined;
  const crc = rootTags['63'] || 'ABCD';

  return {
    formatIndicator: rootTags['00'] || '01',
    initiationMethod: rootTags['01'] || '12',
    guid,
    bankBin,
    accountNumber,
    currency,
    amount,
    memo,
    crc
  };
}

export function calculateForensicRisk(signals: BillForensicsResult['forensicSignals']): {
  riskScore: number;
  riskLevel: RiskLevel;
  recommendation: Recommendation;
} {
  let penalty = 0;
  if (!signals.timestampMatch) penalty += 0.35;
  if (!signals.fontConsistency) penalty += 0.25;
  if (signals.compressionArtifacts) penalty += 0.20;
  if (!signals.logoAuthenticity) penalty += 0.25;
  if (!signals.qrIntegrity) penalty += 0.30;
  penalty += signals.anomalies.length * 0.1;

  const riskScore = Math.min(1.0, Math.max(0.0, penalty));

  let riskLevel: RiskLevel = 'LOW';
  let recommendation: Recommendation = 'AUTO_APPROVE';

  if (riskScore >= 0.7) {
    riskLevel = 'CRITICAL';
    recommendation = 'REJECT';
  } else if (riskScore >= 0.45) {
    riskLevel = 'HIGH';
    recommendation = 'REJECT';
  } else if (riskScore >= 0.2) {
    riskLevel = 'MEDIUM';
    recommendation = 'MANUAL_REVIEW';
  }

  return { riskScore, riskLevel, recommendation };
}

export function crossCheckTimestampWithStatusBar(statusBarClock: string, receiptTimestamp: string): {
  isConsistent: boolean;
  skewMinutes: number;
  anomaly?: string;
} {
  const statusParts = statusBarClock.split(':').map(Number);
  const timeMatch = receiptTimestamp.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!timeMatch) {
    return { isConsistent: false, skewMinutes: 999, anomaly: 'Invalid receipt timestamp format' };
  }

  const receiptHours = parseInt(timeMatch[1], 10);
  const receiptMinutes = parseInt(timeMatch[2], 10);

  const statusTotalMinutes = statusParts[0] * 60 + statusParts[1];
  const receiptTotalMinutes = receiptHours * 60 + receiptMinutes;
  const skew = receiptTotalMinutes - statusTotalMinutes;

  if (receiptTotalMinutes > statusTotalMinutes) {
    return {
      isConsistent: false,
      skewMinutes: skew,
      anomaly: `Transaction time (${timeMatch[1]}:${timeMatch[2]}) is in the future relative to status bar time (${statusBarClock})`
    };
  }

  return {
    isConsistent: skew <= 120,
    skewMinutes: Math.abs(skew)
  };
}

// ==========================================
// 2. PRODUCT STUDIO HELPERS
// ==========================================
export type TonePreset = 'friendly' | 'luxury' | 'youthful' | 'urgent_sale';

export function buildImagen3Prompt(
  productTitle: string,
  category: string,
  theme: string,
  aspectRatio: '1:1' | '9:16' | '16:9' = '1:1'
): { prompt: string; negativePrompt: string; aspectRatio: string } {
  const prompt = `Professional commercial studio photography of ${productTitle}, category ${category}. Staged in a high-end ${theme} setting, clean studio softbox lighting, 8k resolution, authentic Vietnamese aesthetic, sharp focus, hyperrealistic.`;
  const negativePrompt = 'distorted, blurry, low resolution, noisy, plastic artifacts, duplicate, watermarks, text overlay.';
  return { prompt, negativePrompt, aspectRatio };
}

export function generateVietnameseCopy(
  product: { title: string; category: string; price: number; highlights: string[] },
  tone: TonePreset
): ProductMarketingPack['channelCopies'] {
  const formattedPrice = product.price.toLocaleString('vi-VN') + 'đ';

  if (tone === 'luxury') {
    return {
      facebook: {
        headline: `👑 ĐẲNG CẤP VÀ TINH HOA: ${product.title.toUpperCase()}`,
        body: `Tuyệt tác ${product.category} tôn vinh vẻ đẹp quý phái. Từng chi tiết được hoàn thiện tỉ mỉ. Sở hữu ngay với giá đặc quyền ${formattedPrice}.`,
        callToAction: '👉 Liên hệ quản gia riêng để đặt lịch tư vấn và trải nghiệm VIP.',
        hashtags: ['#HangHieu', '#DangCap', '#LuxuryVN', '#SMEAutoPilot']
      },
      tiktokShop: {
        videoHook: 'Đây là lý do giới thượng lưu luôn chọn BST này! ✨',
        videoScript: `Cận cảnh độ hoàn thiện không tì vết của ${product.title}. Chất liệu độc quyền, chạm nhẹ là cảm nhận sự khác biệt.`,
        soundRecommendation: 'Classical Piano & Symphony Ambient',
        hashtags: ['#LuxuryLifestyle', '#TikTokShopLuxury', '#SangTrong']
      },
      zalo: {
        greeting: 'Kính chào Quý khách VIP! 💎',
        promotionText: `Chúng tôi trân trọng giới thiệu siêu phẩm ${product.title} số lượng giới hạn dành riêng cho danh sách ưu tiên.`,
        directOrderLink: `https://smeautopilot.vn/vip/${encodeURIComponent(product.title)}`
      },
      shopee: {
        seoTitle: `[Cao Cấp] ${product.title} - Chất Liệu Thượng Hạng Sang Trọng`,
        bulletPoints: product.highlights.map(h => `• ${h}`),
        searchKeywords: [product.title.toLowerCase(), 'cao cấp', 'chính hãng', 'sang trọng']
      }
    };
  } else if (tone === 'youthful') {
    return {
      facebook: {
        headline: `🔥 GEN Z CHECK! Rinh ngay ${product.title} cực cháy! 🔥`,
        body: `Item quốc dân cho hội mê style đỉnh chóp! Giá học sinh sinh viên chỉ ${formattedPrice}. Nhanh tay kẻo hết size nha mấy bồ!`,
        callToAction: '👉 Thả tim và cmt "CHỐT" để nhận mã freeship liền tay!',
        hashtags: ['#GenZ', '#OOTD', '#TrendingVN', '#DealHot']
      },
      tiktokShop: {
        videoHook: 'U là trời, tìm được em này đúng là chân ái luôn á mọi người ơi! 😱',
        videoScript: `Outfit hôm nay cùng ${product.title}. Mix match kiểu gì cũng xinh xỉu. Bấm ngay giỏ hàng bên dưới để săn mã giảm 50k nha!`,
        soundRecommendation: 'Top Trending V-Pop Remix TikTok 2026',
        hashtags: ['#TikTokShopStyle', '#ReviewDoXinh', '#GenZTrend']
      },
      zalo: {
        greeting: 'Hế lô bạn iu ơi! ✌️',
        promotionText: `Mẫu ${product.title} vừa cập bến là shop nhắn bạn đầu tiên nè. Check liền nha!`,
        directOrderLink: `https://smeautopilot.vn/genz/${encodeURIComponent(product.title)}`
      },
      shopee: {
        seoTitle: `[Hot Trend GenZ] ${product.title} Siêu Xinh Phong Cách Mới Nhất`,
        bulletPoints: product.highlights.map(h => `✨ ${h}`),
        searchKeywords: [product.title.toLowerCase(), 'hot trend', 'gen z', 'giá rẻ']
      }
    };
  } else if (tone === 'urgent_sale') {
    return {
      facebook: {
        headline: `⚡ XẢ KHO DUY NHẤT HÔM NAY: ${product.title.toUpperCase()} ⚡`,
        body: `Cơ hội cuối cùng! Giảm sập sàn chỉ còn ${formattedPrice}. Chỉ còn 15 suất duy nhất trước khi đóng cổng khuyến mãi!`,
        callToAction: '💥 BẤM MUA NGAY ĐỂ GIỮ SUẤT GIẢM GIÁ!',
        hashtags: ['#XaKho', '#SaleSoc', '#GiaHoi', '#DealChopNhoang']
      },
      tiktokShop: {
        videoHook: 'DỪNG LẠI 3 GIÂY! Kho đang xả lỗ mẫu này chỉ hôm nay! 🚨',
        videoScript: `Chỉ 50 đơn đầu tiên có giá ${formattedPrice}! Nhanh tay nhấn vào giỏ hàng trước khi hết voucher!`,
        soundRecommendation: 'High Energy Countdown Drumbeat',
        hashtags: ['#FlashSale', '#GiaReVoDich', '#TikTokShopSale']
      },
      zalo: {
        greeting: 'Thông báo khẩn cấp từ Shop! ⏰',
        promotionText: `Flash Sale 2 giờ cho ${product.title}. Giá giảm sâu chỉ ${formattedPrice}.`,
        directOrderLink: `https://smeautopilot.vn/flash-sale/${encodeURIComponent(product.title)}`
      },
      shopee: {
        seoTitle: `[Flash Sale Chỉ Hôm Nay] ${product.title} - Giảm Cực Sốc`,
        bulletPoints: product.highlights.map(h => `🔥 ${h}`),
        searchKeywords: [product.title.toLowerCase(), 'flash sale', 'xả kho', 'giảm giá']
      }
    };
  } else {
    return {
      facebook: {
        headline: `🌸 Gửi nàng chút dịu dàng cùng ${product.title} 🌸`,
        body: `Chào ngày mới với thiết kế tươi tắn từ ${product.category}. Giá thân thương chỉ ${formattedPrice}. Phù hợp mặc đi làm, đi chơi hay cà phê cuối tuần.`,
        callToAction: '👉 Nhắn tin cho shop để chọn size vừa vặn nhất nhé!',
        hashtags: ['#ThoiTrangNu', '#DiChoiXinh', '#ShopThanThien']
      },
      tiktokShop: {
        videoHook: 'Có ai đang tìm một em vừa xinh vừa thoải mái thế này không? 🥰',
        videoScript: `Cùng mình trải nghiệm ${product.title} nha. Mặc lên nhẹ tênh mà tôn dáng cực kỳ. Shop có đủ size từ S đến XL nhé!`,
        soundRecommendation: 'Acoustic Guitar Gentle Melody',
        hashtags: ['#GocLamDep', '#ThoiTrangHangNgay', '#ShopYeuThich']
      },
      zalo: {
        greeting: 'Dạ Shop em chào Chị ạ! 🌷',
        promotionText: `Shop vừa về mẫu ${product.title} siêu ưng ý. Em gửi hình thật và thông số cho Chị tham khảo nha!`,
        directOrderLink: `https://smeautopilot.vn/friendly/${encodeURIComponent(product.title)}`
      },
      shopee: {
        seoTitle: `[Chính Hãng] ${product.title} Dáng Chuẩn Vải Mát Thoải Mái`,
        bulletPoints: product.highlights.map(h => `🌿 ${h}`),
        searchKeywords: [product.title.toLowerCase(), 'thời trang', 'đẹp', 'chính hãng']
      }
    };
  }
}

export function generateHashtags(category: string, platform: 'facebook' | 'tiktok' | 'shopee'): string[] {
  const baseTags = ['#SMEAutoPilot', '#BuildwithGoogleAI', '#AIRiserVietnam2026'];
  const categoryTag = '#' + category.replace(/\s+/g, '');

  if (platform === 'tiktok') {
    return [...baseTags, categoryTag, '#TikTokShopVN', '#XuHuong', '#ReviewHangTot'];
  } else if (platform === 'facebook') {
    return [...baseTags, categoryTag, '#MuaSamOnline', '#HangChinhHang', '#Freeship'];
  } else {
    return [...baseTags, categoryTag, '#ShopeeCheck', '#ShopeeLiveVN', '#DealHotShopee'];
  }
}

// ==========================================
// 3. VOICE ASSISTANT & TOOLS HELPERS
// ==========================================
export function classifyVietnameseIntent(utterance: string): string {
  const text = utterance.toLowerCase();
  if (/còn\s+(hàng|áo|váy|size|màu)|kiểm\s+tra\s+kho|check\s+kho|hết\s+chưa/i.test(text)) {
    return 'INVENTORY_QUERY';
  }
  if (/ship|phí\s+giao|vận\s+chuyển|tiền\s+ship|giao\s+về/i.test(text)) {
    return 'SHIPPING_CALCULATION';
  }
  if (/đặt\s+(cho|hàng|mua|lấy)|chốt\s+đơn|lấy\s+\d+|gửi\s+về\s+địa\s+chỉ/i.test(text)) {
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

// ==========================================
// 4. MOCK GOOGLE SERVICES (SHEETS, GMAIL, CALENDAR, MAPS, FIREBASE)
// ==========================================
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

export class MockGmailService implements IGmailService {
  private outbox: SentEmailRecord[] = [];

  async sendInvoiceEmail(
    recipient: string,
    order: Order,
    invoiceHtml?: string
  ): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    const messageId = `msg_inv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const record: SentEmailRecord = {
      messageId,
      recipient,
      subject: `[SME AutoPilot] Hóa Đơn & Xác Nhận Đơn Hàng #${order.orderId}`,
      emailType: 'INVOICE',
      sentAt: new Date().toISOString(),
      status: 'SENT',
      orderId: order.orderId
    };
    this.outbox.push(record);
    return { messageId, status: 'SENT' };
  }

  async sendShippingNotification(
    recipient: string,
    trackingInfo: TrackingInfo
  ): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    const messageId = `msg_ship_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const record: SentEmailRecord = {
      messageId,
      recipient,
      subject: `[Giao Hàng] Đơn Hàng #${trackingInfo.orderId} đang được giao - Vận đơn: ${trackingInfo.trackingCode}`,
      emailType: 'SHIPPING_NOTIFICATION',
      sentAt: new Date().toISOString(),
      status: 'SENT',
      orderId: trackingInfo.orderId
    };
    this.outbox.push(record);
    return { messageId, status: 'SENT' };
  }

  async getOutbox(): Promise<SentEmailRecord[]> {
    return [...this.outbox];
  }
}

export class MockCalendarService implements ICalendarService {
  private events: CalendarEvent[] = [];

  async createEvent(eventInput: CalendarEventInput): Promise<CalendarEvent> {
    const eventId = `cal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const event: CalendarEvent = {
      ...eventInput,
      eventId,
      status: 'CONFIRMED',
      htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
      created: new Date().toISOString()
    };
    this.events.push(event);
    return event;
  }

  async listEvents(timeMin?: string, timeMax?: string): Promise<CalendarEvent[]> {
    return [...this.events];
  }
}

export function calculateHaversineDistanceKm(p1: LatLng, p2: LatLng): number {
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export function calculateMotorbikeShippingRate(
  distanceKm: number,
  city: 'Hanoi' | 'Da Nang' | 'Ho Chi Minh City' | string,
  isRushHour: boolean = false
): { shippingRateVnd: number; rateTier: DistanceResult['rateTier']; durationMinutes: number } {
  let rate = 0;
  let tier: DistanceResult['rateTier'] = 'STANDARD_INNER_CITY';
  let speedKmH = isRushHour ? 18 : 28;

  if (distanceKm <= 3.0) {
    rate = 18000;
    tier = 'STANDARD_INNER_CITY';
  } else if (distanceKm <= 7.0) {
    rate = 18000 + Math.round((distanceKm - 3.0) * 4000);
    tier = 'STANDARD_INNER_CITY';
  } else if (distanceKm <= 15.0) {
    rate = 35000 + Math.round((distanceKm - 7.0) * 3500);
    tier = 'SUBURB';
  } else {
    rate = 55000 + Math.round((distanceKm - 15.0) * 5000);
    tier = 'INTER_PROVINCIAL';
  }

  if (isRushHour) {
    rate = Math.round(rate * 1.15);
  }

  const durationMinutes = Math.max(10, Math.round((distanceKm / speedKmH) * 60 + 5));

  return {
    shippingRateVnd: rate,
    rateTier: tier,
    durationMinutes
  };
}

export function optimizeStopsTSP(
  depot: LatLng,
  stops: { id: string; location: LatLng; address: string; customerName: string; customerPhone: string }[]
): RouteOptimizationResult {
  const remaining = [...stops];
  const orderedStops: any[] = [];
  let currentLoc = depot;
  let totalDistanceKm = 0;
  let accumulatedMinutes = 0;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let minDistance = calculateHaversineDistanceKm(currentLoc, remaining[0].location);

    for (let i = 1; i < remaining.length; i++) {
      const dist = calculateHaversineDistanceKm(currentLoc, remaining[i].location);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextStop = remaining.splice(nearestIdx, 1)[0];
    totalDistanceKm += minDistance;
    const legMinutes = Math.round((minDistance / 25) * 60 + 8);
    accumulatedMinutes += legMinutes;

    orderedStops.push({
      stopIndex: orderedStops.length + 1,
      orderId: nextStop.id,
      address: nextStop.address,
      customerName: nextStop.customerName,
      customerPhone: nextStop.customerPhone,
      location: nextStop.location,
      estimatedArrivalMinutes: accumulatedMinutes,
      distanceFromPreviousKm: minDistance
    });

    currentLoc = nextStop.location;
  }

  return {
    depotAddress: 'Kho Tổng Hà Nội (18 Hàng Gai)',
    depotLocation: depot,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalDurationMinutes: accumulatedMinutes,
    optimizedStops: orderedStops,
    totalOrders: stops.length
  };
}

export class MockMapsService implements IMapsService {
  private branches: StoreBranch[] = [
    createMockStoreBranch({
      branchId: 'BR-HN-01',
      name: 'Chi Nhánh Hoàn Kiếm Hà Nội',
      location: { lat: 21.033333, lng: 105.850000 },
      city: 'Hanoi'
    }),
    createMockStoreBranch({
      branchId: 'BR-DN-01',
      name: 'Chi Nhánh Hải Châu Đà Nẵng',
      location: { lat: 16.067778, lng: 108.220833 },
      city: 'Da Nang'
    }),
    createMockStoreBranch({
      branchId: 'BR-HCM-01',
      name: 'Chi Nhánh Quận 1 TP.HCM',
      location: { lat: 10.776889, lng: 106.700806 },
      city: 'Ho Chi Minh City'
    })
  ];

  async calculateDistance(origin: LatLng | string, destination: LatLng | string): Promise<DistanceResult> {
    const oLoc = typeof origin === 'string' ? { lat: 21.0333, lng: 105.8500 } : origin;
    const dLoc = typeof destination === 'string' ? { lat: 21.0285, lng: 105.8542 } : destination;
    const dist = calculateHaversineDistanceKm(oLoc, dLoc);
    const { shippingRateVnd, rateTier, durationMinutes } = calculateMotorbikeShippingRate(dist, 'Hanoi');

    return {
      origin: typeof origin === 'string' ? origin : `${oLoc.lat},${oLoc.lng}`,
      destination: typeof destination === 'string' ? destination : `${dLoc.lat},${dLoc.lng}`,
      distanceKm: dist,
      durationMinutes,
      shippingRateVnd,
      rateTier
    };
  }

  async optimizeDeliveryRoute(depot: LatLng | string, stops: (LatLng | string)[]): Promise<RouteOptimizationResult> {
    const depotLoc: LatLng = typeof depot === 'string' ? { lat: 21.0333, lng: 105.8500 } : depot;
    const mappedStops = stops.map((s, idx) => ({
      id: `ORD-ROUTE-00${idx + 1}`,
      address: typeof s === 'string' ? s : `Điểm giao #${idx + 1}`,
      customerName: `Khách hàng ${idx + 1}`,
      customerPhone: `090000000${idx + 1}`,
      location: typeof s === 'string' ? { lat: 21.0333 + idx * 0.01, lng: 105.8500 + idx * 0.01 } : s
    }));

    return optimizeStopsTSP(depotLoc, mappedStops);
  }

  async getStoreBranches(): Promise<StoreBranch[]> {
    return [...this.branches];
  }

  findNearestBranch(customerLoc: LatLng): { branch: StoreBranch; distanceKm: number } {
    let nearest = this.branches[0];
    let minDistance = calculateHaversineDistanceKm(customerLoc, nearest.location);

    for (const b of this.branches) {
      const d = calculateHaversineDistanceKm(customerLoc, b.location);
      if (d < minDistance) {
        minDistance = d;
        nearest = b;
      }
    }

    return { branch: nearest, distanceKm: minDistance };
  }
}

export class MockFirebaseAuthService {
  private users: Map<string, User> = new Map();
  private validTokens: Map<string, string> = new Map();

  constructor(initialUsers: User[] = []) {
    initialUsers.forEach(u => {
      this.users.set(u.uid, u);
      this.validTokens.set(`token_${u.uid}`, u.uid);
    });
  }

  async verifyToken(token: string): Promise<User> {
    const uid = this.validTokens.get(token);
    if (!uid) {
      throw new Error('Unauthorized: Invalid or expired Firebase auth token');
    }
    const user = this.users.get(uid);
    if (!user) {
      throw new Error('User not found');
    }
    return { ...user };
  }

  createSessionToken(user: User): string {
    this.users.set(user.uid, user);
    const token = `token_${user.uid}`;
    this.validTokens.set(token, user.uid);
    return token;
  }
}

export class MockFirestoreService {
  private auditLogs: Map<string, AuditLogEntry & { tenantId: string }> = new Map();
  private promptTemplates: Map<string, PromptTemplate & { tenantId: string }> = new Map();

  async writeAuditLog(tenantId: string, entry: Omit<AuditLogEntry, 'logId' | 'timestamp'>): Promise<AuditLogEntry> {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const fullEntry: AuditLogEntry & { tenantId: string } = {
      ...entry,
      logId,
      timestamp: new Date().toISOString(),
      tenantId
    };
    this.auditLogs.set(logId, fullEntry);
    return fullEntry;
  }

  async getAuditLogs(tenantId: string, actionFilter?: string): Promise<AuditLogEntry[]> {
    const logs = Array.from(this.auditLogs.values()).filter(l => l.tenantId === tenantId);
    if (actionFilter) {
      return logs.filter(l => l.action === actionFilter);
    }
    return logs;
  }

  async savePromptTemplate(tenantId: string, template: PromptTemplate): Promise<PromptTemplate> {
    this.promptTemplates.set(`${tenantId}_${template.templateId}`, { ...template, tenantId });
    return template;
  }

  async getPromptTemplate(tenantId: string, templateId: string): Promise<PromptTemplate | null> {
    const tmpl = this.promptTemplates.get(`${tenantId}_${templateId}`);
    return tmpl ? { ...tmpl } : null;
  }

  async listPromptTemplates(tenantId: string): Promise<PromptTemplate[]> {
    return Array.from(this.promptTemplates.values())
      .filter(t => t.tenantId === tenantId)
      .map(({ tenantId: _, ...rest }) => rest);
  }
}

export class GoogleServiceFactory {
  private mode: 'DEMO' | 'LIVE' = 'DEMO';
  private sheetsService: ISheetsService;
  private gmailService: IGmailService;
  private calendarService: ICalendarService;
  private mapsService: IMapsService;

  constructor(mode: 'DEMO' | 'LIVE' = 'DEMO') {
    this.mode = mode;
    this.sheetsService = new MockSheetsService();
    this.gmailService = new MockGmailService();
    this.calendarService = new MockCalendarService();
    this.mapsService = new MockMapsService();
  }

  setMode(mode: 'DEMO' | 'LIVE') {
    this.mode = mode;
  }

  getMode(): 'DEMO' | 'LIVE' {
    return this.mode;
  }

  getSheetsService(): ISheetsService {
    return this.sheetsService;
  }

  getGmailService(): IGmailService {
    return this.gmailService;
  }

  getCalendarService(): ICalendarService {
    return this.calendarService;
  }

  getMapsService(): IMapsService {
    return this.mapsService;
  }

  loadSeedData(industry: 'fashion' | 'fnb' | 'cosmetics'): { category: string; shopName: string; itemCount: number } {
    const seed = createMockSeedDataset(industry);
    this.sheetsService = new MockSheetsService(seed.items, []);
    return {
      category: seed.category,
      shopName: seed.shopName,
      itemCount: seed.items.length
    };
  }
}
