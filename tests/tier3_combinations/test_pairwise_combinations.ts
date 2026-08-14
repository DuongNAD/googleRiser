import {
  describe,
  test,
  beforeEach,
  assertEqual,
  assertNotEqual,
  assertTrue,
  assertFalse,
  assertRange,
  assertContains,
  assertMatch,
  assertDefined,
  createMockVietQRReceipt,
  createMockProductMarketingPack,
  createMockOrder,
  createMockInventoryItem,
  createMockCalendarEvent,
  createMockTrackingInfo,
  createMockStoreBranch,
  createMockUser,
  createMockPromptTemplate,
  createMockSeedDataset,
  generateVietQRPayload
} from '../harness';

import {
  BillForensicsResult,
  ProductMarketingPack,
  Order,
  OrderItem,
  InventoryItem,
  CalendarEvent,
  CalendarEventInput,
  TrackingInfo,
  SentEmailRecord,
  DistanceResult,
  RouteOptimizationResult,
  StoreBranch,
  User,
  AuditLogEntry,
  PromptTemplate,
  HealthStatus,
  VoiceAssistantTurn,
  VoiceAssistantSession,
  VoiceToolCall,
  VoiceToolResult,
  ApiResponse
} from '../../shared';

// ============================================================================
// SIMULATED CROSS-MODULE ENGINES & INTEGRATION ADAPTERS
// ============================================================================

export class MockSheetsService {
  private inventory: Map<string, InventoryItem> = new Map();
  private orders: Map<string, Order> = new Map();

  constructor(seedItems?: InventoryItem[], seedOrders?: Order[]) {
    if (seedItems) {
      seedItems.forEach(i => this.inventory.set(i.sku, { ...i }));
    }
    if (seedOrders) {
      seedOrders.forEach(o => this.orders.set(o.orderId, { ...o }));
    }
  }

  async getInventory(): Promise<InventoryItem[]> {
    return Array.from(this.inventory.values());
  }

  async getInventoryItem(sku: string): Promise<InventoryItem | undefined> {
    const item = this.inventory.get(sku);
    return item ? { ...item } : undefined;
  }

  async updateInventoryStock(sku: string, delta: number): Promise<InventoryItem> {
    const item = this.inventory.get(sku);
    if (!item) {
      throw new Error(`SKU not found in inventory: ${sku}`);
    }
    if (item.stock + delta < 0) {
      throw new Error(`Insufficient stock for SKU ${sku}: current ${item.stock}, requested delta ${delta}`);
    }
    item.stock += delta;
    item.lastUpdated = new Date().toISOString();
    this.inventory.set(sku, item);
    return { ...item };
  }

  async updateProductDetails(sku: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    const item = this.inventory.get(sku);
    if (!item) {
      throw new Error(`SKU not found in inventory: ${sku}`);
    }
    const updated = { ...item, ...updates, lastUpdated: new Date().toISOString() };
    this.inventory.set(sku, updated);
    return { ...updated };
  }

  async getOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrder(orderId: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    return order ? { ...order } : undefined;
  }

  async appendOrder(order: Order): Promise<Order> {
    this.orders.set(order.orderId, { ...order });
    return { ...order };
  }

  async updateOrderStatus(orderId: string, status: Order['orderStatus'], paymentStatus?: Order['paymentStatus'], transactionRef?: string): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }
    order.orderStatus = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (transactionRef) order.transactionRef = transactionRef;
    order.updatedAt = new Date().toISOString();
    this.orders.set(orderId, order);
    return { ...order };
  }

  async syncAll(): Promise<{ inventoryCount: number; ordersCount: number }> {
    return {
      inventoryCount: this.inventory.size,
      ordersCount: this.orders.size
    };
  }
}

export class MockGmailService {
  private outbox: SentEmailRecord[] = [];

  async sendInvoiceEmail(recipient: string, order: Order, invoiceHtml?: string): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    const messageId = `msg_inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: SentEmailRecord = {
      messageId,
      recipient,
      subject: `[SME AutoPilot] Hóa đơn điện tử xác nhận đơn hàng #${order.orderId}`,
      emailType: 'INVOICE',
      sentAt: new Date().toISOString(),
      status: 'SENT',
      orderId: order.orderId
    };
    this.outbox.push(record);
    return { messageId, status: 'SENT' };
  }

  async sendShippingNotification(recipient: string, trackingInfo: TrackingInfo): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    const messageId = `msg_trk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: SentEmailRecord = {
      messageId,
      recipient,
      subject: `[SME AutoPilot] Thông báo vận chuyển đơn hàng #${trackingInfo.orderId} - Mã vận đơn ${trackingInfo.trackingCode}`,
      emailType: 'SHIPPING_NOTIFICATION',
      sentAt: new Date().toISOString(),
      status: 'SENT',
      orderId: trackingInfo.orderId
    };
    this.outbox.push(record);
    return { messageId, status: 'SENT' };
  }

  async sendDriverManifest(driverEmail: string, manifestHtml: string, stopsCount: number): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    const messageId = `msg_drv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: SentEmailRecord = {
      messageId,
      recipient: driverEmail,
      subject: `[SME AutoPilot] Lịch trình giao hàng tối ưu (${stopsCount} điểm giao)`,
      emailType: 'SHIPPING_NOTIFICATION',
      sentAt: new Date().toISOString(),
      status: 'SENT'
    };
    this.outbox.push(record);
    return { messageId, status: 'SENT' };
  }

  async getOutbox(): Promise<SentEmailRecord[]> {
    return [...this.outbox];
  }
}

export class MockCalendarService {
  private events: CalendarEvent[] = [];

  async createEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    const eventId = `cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const event: CalendarEvent = {
      ...input,
      eventId,
      status: 'CONFIRMED',
      htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
      created: new Date().toISOString()
    };
    this.events.push(event);
    return event;
  }

  async listEvents(): Promise<CalendarEvent[]> {
    return [...this.events];
  }
}

export class MockMapsService {
  private branches: StoreBranch[] = [
    createMockStoreBranch({
      branchId: 'BR-HN-01',
      name: 'Kho Tổng Hoàn Kiếm Hà Nội',
      address: '18 Hàng Gai, Hoàn Kiếm, Hà Nội',
      location: { lat: 21.0333, lng: 105.8500 }
    }),
    createMockStoreBranch({
      branchId: 'BR-HCM-01',
      name: 'Kho Quận 1 TP. Hồ Chí Minh',
      address: '120 Nguyễn Huệ, Quận 1, TP.HCM',
      city: 'Ho Chi Minh City',
      location: { lat: 10.7769, lng: 106.7009 }
    })
  ];

  async calculateDistance(origin: string, destination: string): Promise<DistanceResult> {
    // Determine shipping tier and distance based on destination name
    let distanceKm = 4.5;
    let rateTier: DistanceResult['rateTier'] = 'STANDARD_INNER_CITY';
    let shippingRateVnd = 22000;

    const lowerDest = destination.toLowerCase();
    if (lowerDest.includes('đông anh') || lowerDest.includes('gia lâm') || lowerDest.includes('hóc môn') || lowerDest.includes('bình chánh')) {
      distanceKm = 18.5;
      rateTier = 'SUBURB';
      shippingRateVnd = 45000;
    } else if (lowerDest.includes('đà nẵng') || lowerDest.includes('hải phòng') || lowerDest.includes('cần thơ')) {
      distanceKm = 120.0;
      rateTier = 'INTER_PROVINCIAL';
      shippingRateVnd = 75000;
    } else if (lowerDest.includes('hỏa tốc') || lowerDest.includes('express')) {
      distanceKm = 5.0;
      rateTier = 'EXPRESS';
      shippingRateVnd = 35000;
    }

    const durationMinutes = Math.round(distanceKm * 2.8 + 8);

    return {
      origin,
      destination,
      distanceKm,
      durationMinutes,
      shippingRateVnd,
      rateTier
    };
  }

  async optimizeDeliveryRoute(depot: string, stops: string[]): Promise<RouteOptimizationResult> {
    const depotLoc = { lat: 21.0333, lng: 105.8500 };
    let accumulatedMinutes = 15;
    let totalDist = 0;

    const optimizedStops = stops.map((address, idx) => {
      const legDist = 2.5 + (idx * 0.8);
      totalDist += legDist;
      accumulatedMinutes += Math.round(legDist * 3 + 5);
      return {
        stopIndex: idx + 1,
        orderId: `ORD-VN-BATCH-${idx + 1}`,
        address,
        customerName: `Khách Hàng Điểm ${idx + 1}`,
        customerPhone: `098${idx}123456`,
        location: { lat: 21.0333 + (idx * 0.01), lng: 105.8500 + (idx * 0.012) },
        estimatedArrivalMinutes: accumulatedMinutes,
        distanceFromPreviousKm: parseFloat(legDist.toFixed(1))
      };
    });

    return {
      depotAddress: depot,
      depotLocation: depotLoc,
      totalDistanceKm: parseFloat(totalDist.toFixed(1)),
      totalDurationMinutes: accumulatedMinutes,
      optimizedStops,
      totalOrders: stops.length
    };
  }

  async getStoreBranches(): Promise<StoreBranch[]> {
    return [...this.branches];
  }
}

export class MockFirestoreAuditService {
  private logs: AuditLogEntry[] = [];
  private users: Map<string, User> = new Map();
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    const defaultUser = createMockUser();
    this.users.set(defaultUser.uid, defaultUser);
    const defaultTmpl = createMockPromptTemplate();
    this.templates.set(defaultTmpl.templateId, defaultTmpl);
  }

  async recordAuditLog(entry: Omit<AuditLogEntry, 'logId' | 'timestamp'>): Promise<AuditLogEntry> {
    const log: AuditLogEntry = {
      ...entry,
      logId: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    this.logs.push(log);
    return log;
  }

  async getAuditLogs(action?: AuditLogEntry['action']): Promise<AuditLogEntry[]> {
    if (action) {
      return this.logs.filter(l => l.action === action);
    }
    return [...this.logs];
  }

  async getUser(uid: string): Promise<User | undefined> {
    const u = this.users.get(uid);
    return u ? { ...u } : undefined;
  }

  async getPromptTemplate(id: string): Promise<PromptTemplate | undefined> {
    const t = this.templates.get(id);
    return t ? { ...t } : undefined;
  }
}

// ============================================================================
// TIER 3 PAIRWISE COMBINATIONS TEST SUITE
// ============================================================================

describe('Tier 3: Pairwise Combinatorial & Cross-Feature Integration (C1–C25)', () => {
  let sheetsService: MockSheetsService;
  let gmailService: MockGmailService;
  let calendarService: MockCalendarService;
  let mapsService: MockMapsService;
  let auditService: MockFirestoreAuditService;

  const initialItem = createMockInventoryItem({
    sku: 'AD-LUA-HD-RED-L',
    name: 'Áo Dài Lụa Hà Đông Đỏ L',
    stock: 25,
    price: 450000
  });

  beforeEach(() => {
    sheetsService = new MockSheetsService([initialItem]);
    gmailService = new MockGmailService();
    calendarService = new MockCalendarService();
    mapsService = new MockMapsService();
    auditService = new MockFirestoreAuditService();
  });

  // --------------------------------------------------------------------------
  // C1: Voice Order (F3) -> Inventory Decrement (F4)
  // --------------------------------------------------------------------------
  test('C1: Voice Order (F3) -> Inventory Decrement (F4)', async () => {
    const turn: VoiceAssistantTurn = {
      role: 'user',
      content: 'Cho mình đặt 2 bộ Áo Dài Lụa Hà Đông màu đỏ size L giao về Hà Nội nhé',
      intent: 'ORDER_CREATION',
      toolCalls: [
        {
          name: 'update_inventory_stock',
          args: { sku: 'AD-LUA-HD-RED-L', delta: -2 }
        }
      ]
    };

    const toolCall = turn.toolCalls![0];
    const updatedItem = await sheetsService.updateInventoryStock(toolCall.args.sku, toolCall.args.delta);

    assertEqual(updatedItem.sku, 'AD-LUA-HD-RED-L');
    assertEqual(updatedItem.stock, 23, 'Inventory stock must decrement from 25 to 23');
    const persisted = await sheetsService.getInventoryItem('AD-LUA-HD-RED-L');
    assertEqual(persisted!.stock, 23);
  });

  // --------------------------------------------------------------------------
  // C2: Voice Order (F3) -> Google Sheets Append (F4)
  // --------------------------------------------------------------------------
  test('C2: Voice Order (F3) -> Google Sheets Append (F4)', async () => {
    const voiceDraftOrder = createMockOrder({
      orderId: 'ORD-VOICE-001',
      customerName: 'Lê Thị Thu Thảo',
      customerPhone: '0934567890',
      items: [
        {
          sku: 'AD-LUA-HD-RED-L',
          name: 'Áo Dài Lụa Hà Đông Đỏ L',
          quantity: 2,
          unitPrice: 450000,
          subtotal: 900000
        }
      ],
      itemsSubtotal: 900000,
      totalAmount: 900000,
      orderStatus: 'CONFIRMED'
    });

    const appended = await sheetsService.appendOrder(voiceDraftOrder);

    assertEqual(appended.orderId, 'ORD-VOICE-001');
    const allOrders = await sheetsService.getOrders();
    assertEqual(allOrders.length, 1);
    assertEqual(allOrders[0].customerName, 'Lê Thị Thu Thảo');
    assertEqual(allOrders[0].totalAmount, 900000);
  });

  // --------------------------------------------------------------------------
  // C3: Voice Order (F3) -> Gmail Invoice Dispatch (F5)
  // --------------------------------------------------------------------------
  test('C3: Voice Order (F3) -> Gmail Invoice Dispatch (F5)', async () => {
    const order = createMockOrder({ orderId: 'ORD-INV-992' });
    const emailResult = await gmailService.sendInvoiceEmail('customer.thao@gmail.com', order);

    assertEqual(emailResult.status, 'SENT');
    assertTrue(emailResult.messageId.startsWith('msg_inv_'));

    const outbox = await gmailService.getOutbox();
    assertEqual(outbox.length, 1);
    assertEqual(outbox[0].recipient, 'customer.thao@gmail.com');
    assertContains(outbox[0].subject, 'ORD-INV-992');
    assertEqual(outbox[0].emailType, 'INVOICE');
  });

  // --------------------------------------------------------------------------
  // C4: Voice Order (F3) -> Calendar Delivery Event (F5)
  // --------------------------------------------------------------------------
  test('C4: Voice Order (F3) -> Calendar Delivery Event (F5)', async () => {
    const deliveryScheduleInput: CalendarEventInput = {
      summary: '📦 Giao hàng đơn #ORD-VOICE-001 - Lê Thị Thu Thảo',
      description: 'Giao 2 bộ Áo Dài Lụa. Địa chỉ: 45 Tràng Tiền, Hoàn Kiếm. SĐT: 0934567890',
      startDateTime: '2026-08-15T14:00:00+07:00',
      endDateTime: '2026-08-15T15:00:00+07:00',
      location: '45 Tràng Tiền, Hoàn Kiếm, Hà Nội',
      eventType: 'ORDER_PICKUP',
      attendees: ['shipper@smeautopilot.vn', 'customer.thao@gmail.com']
    };

    const event = await calendarService.createEvent(deliveryScheduleInput);

    assertEqual(event.status, 'CONFIRMED');
    assertEqual(event.eventType, 'ORDER_PICKUP');
    assertContains(event.summary, 'ORD-VOICE-001');
    const eventsList = await calendarService.listEvents();
    assertEqual(eventsList.length, 1);
  });

  // --------------------------------------------------------------------------
  // C5: Voice Order (F3) -> Maps Shipping Fee Calculation (F6)
  // --------------------------------------------------------------------------
  test('C5: Voice Order (F3) -> Maps Shipping Fee Calculation (F6)', async () => {
    const originWarehouse = '18 Hàng Gai, Hoàn Kiếm, Hà Nội';
    const customerDestination = '45 Tràng Tiền, Hoàn Kiếm, Hà Nội';

    const distanceInfo = await mapsService.calculateDistance(originWarehouse, customerDestination);

    assertEqual(distanceInfo.rateTier, 'STANDARD_INNER_CITY');
    assertEqual(distanceInfo.shippingRateVnd, 22000);
    assertRange(distanceInfo.distanceKm, 1, 10);
    assertRange(distanceInfo.durationMinutes, 5, 30);
  });

  // --------------------------------------------------------------------------
  // C6: VietQR Bill Audit (F1) -> Order Status Update (F12)
  // --------------------------------------------------------------------------
  test('C6: VietQR Bill Audit (F1) -> Order Status Update (F12)', async () => {
    const order = createMockOrder({
      orderId: 'ORD-AUDIT-101',
      totalAmount: 450000,
      orderStatus: 'DRAFT',
      paymentStatus: 'PENDING'
    });
    await sheetsService.appendOrder(order);

    const verifiedReceipt = createMockVietQRReceipt({
      matchedOrderId: 'ORD-AUDIT-101',
      recommendation: 'AUTO_APPROVE',
      extractedData: {
        amount: 450000,
        transactionId: 'FT24081498124501',
        bankName: 'Vietcombank',
        accountNumber: '1029384756',
        accountHolder: 'NGUYEN VAN AN',
        currency: 'VND',
        transactionTime: '2026-08-14 10:25:30',
        transferContent: 'ORD-AUDIT-101'
      }
    });

    if (verifiedReceipt.recommendation === 'AUTO_APPROVE' && verifiedReceipt.matchedOrderId) {
      await sheetsService.updateOrderStatus(
        verifiedReceipt.matchedOrderId,
        'CONFIRMED',
        'VERIFIED',
        verifiedReceipt.extractedData.transactionId
      );
    }

    const updated = await sheetsService.getOrder('ORD-AUDIT-101');
    assertEqual(updated!.orderStatus, 'CONFIRMED');
    assertEqual(updated!.paymentStatus, 'VERIFIED');
    assertEqual(updated!.transactionRef, 'FT24081498124501');
  });

  // --------------------------------------------------------------------------
  // C7: VietQR Bill Audit (F1) -> Dashboard Fraud KPI Alert (F11)
  // --------------------------------------------------------------------------
  test('C7: VietQR Bill Audit (F1) -> Dashboard Fraud KPI Alert (F11)', async () => {
    const forgedReceipt = createMockVietQRReceipt({
      isAuthentic: false,
      riskLevel: 'CRITICAL',
      recommendation: 'REJECT',
      forensicSignals: {
        timestampMatch: false,
        fontConsistency: false,
        compressionArtifacts: true,
        logoAuthenticity: false,
        qrIntegrity: false,
        anomalies: ['Font tampering detected in amount field', 'Timestamp desynced from status bar']
      }
    });

    // Simulating Dashboard KPI aggregator
    const dashboardMetrics = {
      totalAudited: 150,
      fraudAttemptsBlocked: 3,
      preventedLossVnd: 1850000,
      criticalAlerts: [] as string[]
    };

    if (forgedReceipt.riskLevel === 'CRITICAL' && forgedReceipt.recommendation === 'REJECT') {
      dashboardMetrics.totalAudited += 1;
      dashboardMetrics.fraudAttemptsBlocked += 1;
      dashboardMetrics.preventedLossVnd += forgedReceipt.extractedData.amount;
      dashboardMetrics.criticalAlerts.push(
        `🚨 Cảnh báo gian lận bill chuyển khoản: ${forgedReceipt.forensicSignals.anomalies.join('; ')}`
      );
    }

    assertEqual(dashboardMetrics.fraudAttemptsBlocked, 4);
    assertEqual(dashboardMetrics.preventedLossVnd, 2300000);
    assertEqual(dashboardMetrics.criticalAlerts.length, 1);
    assertContains(dashboardMetrics.criticalAlerts[0], 'Font tampering detected');
  });

  // --------------------------------------------------------------------------
  // C8: VietQR Bill Audit (F1) -> Firestore Audit Trail (F7)
  // --------------------------------------------------------------------------
  test('C8: VietQR Bill Audit (F1) -> Firestore Audit Trail (F7)', async () => {
    const auditResult = createMockVietQRReceipt({
      matchedOrderId: 'ORD-TRAIL-88',
      riskLevel: 'LOW',
      recommendation: 'AUTO_APPROVE'
    });

    const logEntry = await auditService.recordAuditLog({
      action: 'BILL_AUDITED',
      actorId: 'operator_hanoi_01',
      details: {
        orderId: auditResult.matchedOrderId,
        amount: auditResult.extractedData.amount,
        bank: auditResult.extractedData.bankName,
        transactionId: auditResult.extractedData.transactionId,
        isAuthentic: auditResult.isAuthentic
      },
      riskLevel: auditResult.riskLevel,
      status: 'SUCCESS'
    });

    assertTrue(logEntry.logId.startsWith('log_'));
    assertEqual(logEntry.action, 'BILL_AUDITED');
    assertEqual(logEntry.details.orderId, 'ORD-TRAIL-88');

    const logs = await auditService.getAuditLogs('BILL_AUDITED');
    assertEqual(logs.length, 1);
  });

  // --------------------------------------------------------------------------
  // C9: VietQR Bill Audit (F1) -> Gmail Customer Confirmation (F5)
  // --------------------------------------------------------------------------
  test('C9: VietQR Bill Audit (F1) -> Gmail Customer Confirmation (F5)', async () => {
    const verifiedOrder = createMockOrder({
      orderId: 'ORD-CONFIRM-202',
      paymentStatus: 'VERIFIED',
      customerName: 'Hoàng Minh Tuấn'
    });

    const emailRes = await gmailService.sendInvoiceEmail('hoang.minh.tuan@gmail.com', verifiedOrder);
    assertEqual(emailRes.status, 'SENT');

    const outbox = await gmailService.getOutbox();
    const sentEmail = outbox.find(e => e.orderId === 'ORD-CONFIRM-202');
    assertDefined(sentEmail);
    assertEqual(sentEmail.recipient, 'hoang.minh.tuan@gmail.com');
  });

  // --------------------------------------------------------------------------
  // C10: Product Studio (F2) -> Product Studio UI Workbench (F13)
  // --------------------------------------------------------------------------
  test('C10: Product Studio (F2) -> Product Studio UI Workbench (F13)', () => {
    const marketingPack = createMockProductMarketingPack({
      productTitle: 'Váy Linen Cổ Yếm Thêu Hoa Mai',
      tonePreset: 'luxury'
    });

    // Simulated UI Workbench State
    const workbenchState = {
      activeTab: 'facebook',
      previewPrompt: marketingPack.studioPrompts.prompt,
      aspectRatio: marketingPack.studioPrompts.aspectRatio,
      currentCopies: marketingPack.channelCopies,
      selectedTone: marketingPack.tonePreset
    };

    assertEqual(workbenchState.selectedTone, 'luxury');
    assertEqual(workbenchState.aspectRatio, '1:1');
    assertContains(workbenchState.currentCopies.facebook.headline, '✨');
    assertContains(workbenchState.currentCopies.tiktokShop.videoHook, 'áo dài');
    assertContains(workbenchState.currentCopies.zalo.greeting, 'Dạ em chào');
  });

  // --------------------------------------------------------------------------
  // C11: Product Studio (F2) -> Calendar Livestream Scheduling (F5)
  // --------------------------------------------------------------------------
  test('C11: Product Studio (F2) -> Calendar Livestream Scheduling (F5)', async () => {
    const marketingPack = createMockProductMarketingPack({
      productTitle: 'Áo Dài Lụa Vạn Phúc Thêu Sen Vàng'
    });

    const livestreamEvent = await calendarService.createEvent({
      summary: `🎥 Livestream Ra Mắt: ${marketingPack.productTitle}`,
      description: `Chiến dịch bán hàng TikTok Shop & FB Live.\nHook: ${marketingPack.channelCopies.tiktokShop.videoHook}`,
      startDateTime: '2026-08-16T20:00:00+07:00',
      endDateTime: '2026-08-16T22:00:00+07:00',
      location: 'Studio TikTok Shop SME AutoPilot',
      eventType: 'LIVESTREAM_SALES'
    });

    assertEqual(livestreamEvent.eventType, 'LIVESTREAM_SALES');
    assertContains(livestreamEvent.summary, 'Áo Dài Lụa Vạn Phúc');
    assertContains(livestreamEvent.description, 'TikTok Shop');
  });

  // --------------------------------------------------------------------------
  // C12: Product Studio (F2) -> Multi-Channel Copy to Sheets Inventory (F4)
  // --------------------------------------------------------------------------
  test('C12: Product Studio (F2) -> Multi-Channel Copy to Sheets Inventory (F4)', async () => {
    const marketingPack = createMockProductMarketingPack({
      productTitle: 'Áo Dài Lụa Hà Đông Đỏ Thêu Sen (Bản Nâng Cấp)',
      extractedAttributes: {
        category: 'Thời Trang Nữ',
        targetAudience: 'Phụ nữ 25-45',
        keySellingPoints: ['100% Lụa Tơ Tằm', 'Thêu tay thủ công']
      }
    });

    const updatedInventory = await sheetsService.updateProductDetails('AD-LUA-HD-RED-L', {
      name: marketingPack.productTitle,
      category: marketingPack.extractedAttributes.category
    });

    assertEqual(updatedInventory.name, 'Áo Dài Lụa Hà Đông Đỏ Thêu Sen (Bản Nâng Cấp)');
    const saved = await sheetsService.getInventoryItem('AD-LUA-HD-RED-L');
    assertEqual(saved!.name, 'Áo Dài Lụa Hà Đông Đỏ Thêu Sen (Bản Nâng Cấp)');
  });

  // --------------------------------------------------------------------------
  // C13: Google Sheets Sync (F4) -> Order Management UI Table (F12)
  // --------------------------------------------------------------------------
  test('C13: Google Sheets Sync (F4) -> Order Management UI Table (F12)', async () => {
    // Populate 3 test orders in sheets
    await sheetsService.appendOrder(createMockOrder({ orderId: 'ORD-001', orderStatus: 'CONFIRMED' }));
    await sheetsService.appendOrder(createMockOrder({ orderId: 'ORD-002', orderStatus: 'DRAFT' }));
    await sheetsService.appendOrder(createMockOrder({ orderId: 'ORD-003', orderStatus: 'CONFIRMED' }));

    const ordersFromSheets = await sheetsService.getOrders();

    // Simulated UI Table Filtering
    const confirmedOrders = ordersFromSheets.filter(o => o.orderStatus === 'CONFIRMED');
    const draftOrders = ordersFromSheets.filter(o => o.orderStatus === 'DRAFT');

    assertEqual(ordersFromSheets.length, 3);
    assertEqual(confirmedOrders.length, 2);
    assertEqual(draftOrders.length, 1);
  });

  // --------------------------------------------------------------------------
  // C14: Google Sheets Sync (F4) -> Dashboard Revenue Metrics (F11)
  // --------------------------------------------------------------------------
  test('C14: Google Sheets Sync (F4) -> Dashboard Revenue Metrics (F11)', async () => {
    await sheetsService.appendOrder(createMockOrder({ orderId: 'ORD-GMV-1', totalAmount: 450000, paymentStatus: 'VERIFIED' }));
    await sheetsService.appendOrder(createMockOrder({ orderId: 'ORD-GMV-2', totalAmount: 850000, paymentStatus: 'VERIFIED' }));
    await sheetsService.appendOrder(createMockOrder({ orderId: 'ORD-GMV-3', totalAmount: 300000, paymentStatus: 'PENDING' }));

    const orders = await sheetsService.getOrders();
    const verifiedOrders = orders.filter(o => o.paymentStatus === 'VERIFIED');
    const totalGmv = verifiedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const aov = verifiedOrders.length > 0 ? totalGmv / verifiedOrders.length : 0;

    assertEqual(totalGmv, 1300000, 'Total verified GMV must be 1,300,000 VND');
    assertEqual(aov, 650000, 'Average Order Value must be 650,000 VND');
  });

  // --------------------------------------------------------------------------
  // C15: Maps Route Optimization (F6) -> Order Batch Dispatch (F12)
  // --------------------------------------------------------------------------
  test('C15: Maps Route Optimization (F6) -> Order Batch Dispatch (F12)', async () => {
    const stops = [
      '45 Tràng Tiền, Hoàn Kiếm, Hà Nội',
      '12 Bà Triệu, Hai Bà Trưng, Hà Nội',
      '88 Cầu Giấy, Cầu Giấy, Hà Nội',
      '105 Láng Hạ, Đống Đa, Hà Nội'
    ];

    const routeResult = await mapsService.optimizeDeliveryRoute('18 Hàng Gai, Hoàn Kiếm, Hà Nội', stops);

    assertEqual(routeResult.totalOrders, 4);
    assertEqual(routeResult.optimizedStops.length, 4);
    assertTrue(routeResult.totalDistanceKm > 0);
    assertTrue(routeResult.totalDurationMinutes > 0);

    // Verify stops are sequentially indexed
    routeResult.optimizedStops.forEach((stop, idx) => {
      assertEqual(stop.stopIndex, idx + 1);
    });
  });

  // --------------------------------------------------------------------------
  // C16: Maps Shipping Tier (F6) -> Voice Assistant Tool Call (F3)
  // --------------------------------------------------------------------------
  test('C16: Maps Shipping Tier (F6) -> Voice Assistant Tool Call (F3)', async () => {
    // Tool call for suburb address
    const suburbDistance = await mapsService.calculateDistance(
      '18 Hàng Gai, Hoàn Kiếm',
      'Xã Đông Hội, Huyện Đông Anh, Hà Nội'
    );

    assertEqual(suburbDistance.rateTier, 'SUBURB');
    assertEqual(suburbDistance.shippingRateVnd, 45000);

    // Tool result passed back to Voice Assistant Turn
    const toolResult: VoiceToolResult = {
      toolName: 'calculate_shipping_fee',
      result: {
        destination: suburbDistance.destination,
        rateTier: suburbDistance.rateTier,
        fee: suburbDistance.shippingRateVnd,
        formattedFee: '45.000 đ'
      }
    };

    assertEqual(toolResult.result.fee, 45000);
    assertEqual(toolResult.result.rateTier, 'SUBURB');
  });

  // --------------------------------------------------------------------------
  // C17: Mock Engine Toggle (F8) -> All REST API Endpoints (F9)
  // --------------------------------------------------------------------------
  test('C17: Mock Engine Toggle (F8) -> All REST API Endpoints (F9)', () => {
    class ApiRouterSimulator {
      private isDemoMode: boolean = true;

      setMode(mode: 'DEMO' | 'LIVE') {
        this.isDemoMode = (mode === 'DEMO');
      }

      getAuditEndpointConfig() {
        return {
          mode: this.isDemoMode ? 'DEMO' : 'LIVE',
          dataProvider: this.isDemoMode ? 'seed_vietqr_dataset' : 'gemini_flash_live_api',
          requiresGoogleOAuth: !this.isDemoMode
        };
      }
    }

    const router = new ApiRouterSimulator();
    const demoConfig = router.getAuditEndpointConfig();
    assertEqual(demoConfig.mode, 'DEMO');
    assertEqual(demoConfig.dataProvider, 'seed_vietqr_dataset');
    assertFalse(demoConfig.requiresGoogleOAuth);

    router.setMode('LIVE');
    const liveConfig = router.getAuditEndpointConfig();
    assertEqual(liveConfig.mode, 'LIVE');
    assertEqual(liveConfig.dataProvider, 'gemini_flash_live_api');
    assertTrue(liveConfig.requiresGoogleOAuth);
  });

  // --------------------------------------------------------------------------
  // C18: Mock Engine Toggle (F8) -> React SPA State Context (F10)
  // --------------------------------------------------------------------------
  test('C18: Mock Engine Toggle (F8) -> React SPA State Context (F10)', () => {
    interface AppContextState {
      appMode: 'DEMO' | 'LIVE';
      activeDataset: 'fashion' | 'fnb' | 'cosmetics';
      liveApiKeyConfigured: boolean;
      bannerMessage: string;
    }

    let state: AppContextState = {
      appMode: 'DEMO',
      activeDataset: 'fashion',
      liveApiKeyConfigured: false,
      bannerMessage: 'Chế độ Trải nghiệm Giám khảo (Demo Mode)'
    };

    function toggleMode(targetMode: 'DEMO' | 'LIVE') {
      state = {
        ...state,
        appMode: targetMode,
        bannerMessage: targetMode === 'DEMO'
          ? 'Chế độ Trải nghiệm Giám khảo (Demo Mode)'
          : 'Chế độ Trực tiếp (Live API Production Mode)'
      };
    }

    assertEqual(state.appMode, 'DEMO');
    toggleMode('LIVE');
    assertEqual(state.appMode, 'LIVE');
    assertContains(state.bannerMessage, 'Chế độ Trực tiếp');
  });

  // --------------------------------------------------------------------------
  // C19: Firebase Auth State (F7) -> Express Auth Middleware (F9)
  // --------------------------------------------------------------------------
  test('C19: Firebase Auth State (F7) -> Express Auth Middleware (F9)', async () => {
    function authMiddleware(token: string | undefined, userStore: MockFirestoreAuditService): { authorized: boolean; user?: User; error?: string } {
      if (!token) {
        return { authorized: false, error: 'Unauthorized: Missing Authorization header' };
      }
      if (token === 'Bearer mock_token_judge') {
        return {
          authorized: true,
          user: createMockUser({ role: 'demo_judge', displayName: 'Giám Khảo Cuộc Thi AI Riser' })
        };
      }
      if (token === 'Bearer mock_token_merchant') {
        return {
          authorized: true,
          user: createMockUser({ role: 'merchant' })
        };
      }
      return { authorized: false, error: 'Forbidden: Invalid or expired token' };
    }

    const missingRes = authMiddleware(undefined, auditService);
    assertFalse(missingRes.authorized);
    assertEqual(missingRes.error, 'Unauthorized: Missing Authorization header');

    const judgeRes = authMiddleware('Bearer mock_token_judge', auditService);
    assertTrue(judgeRes.authorized);
    assertEqual(judgeRes.user!.role, 'demo_judge');

    const invalidRes = authMiddleware('Bearer invalid_token', auditService);
    assertFalse(invalidRes.authorized);
    assertContains(invalidRes.error!, 'Forbidden');
  });

  // --------------------------------------------------------------------------
  // C20: Voice Assistant Widget (F14) -> Backend SSE Stream (F9)
  // --------------------------------------------------------------------------
  test('C20: Voice Assistant Widget (F14) -> Backend SSE Stream (F9)', () => {
    // Simulate SSE chunk emissions for voice response
    const sseEvents: { event: string; data: string }[] = [];

    function simulateVoiceSSEStream(userUtterance: string) {
      sseEvents.push({ event: 'status', data: JSON.stringify({ state: 'LISTENING' }) });
      sseEvents.push({ event: 'transcript', data: JSON.stringify({ text: userUtterance }) });
      sseEvents.push({ event: 'tool_start', data: JSON.stringify({ tool: 'query_inventory', args: { sku: 'AD-01' } }) });
      sseEvents.push({ event: 'tool_result', data: JSON.stringify({ inStock: true, count: 25 }) });
      sseEvents.push({ event: 'token', data: JSON.stringify({ chunk: 'Dạ sản phẩm ' }) });
      sseEvents.push({ event: 'token', data: JSON.stringify({ chunk: 'Áo Dài còn 25 bộ ạ.' }) });
      sseEvents.push({ event: 'complete', data: JSON.stringify({ fullText: 'Dạ sản phẩm Áo Dài còn 25 bộ ạ.' }) });
    }

    simulateVoiceSSEStream('Shop còn áo dài không?');

    assertEqual(sseEvents.length, 7);
    assertEqual(sseEvents[0].event, 'status');
    assertEqual(sseEvents[2].event, 'tool_start');
    assertEqual(sseEvents[6].event, 'complete');
  });

  // --------------------------------------------------------------------------
  // C21: Dropzone Upload (F11) -> Gemini Multimodal Forensics Engine (F1)
  // --------------------------------------------------------------------------
  test('C21: Dropzone Upload (F11) -> Gemini Multimodal Forensics Engine (F1)', () => {
    // Simulate dropzone receiving base64 image and calling forensics handler
    const mockDroppedFile = {
      name: 'vietcombank_bill_transfer.jpg',
      size: 145020,
      type: 'image/jpeg',
      base64Data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...'
    };

    function handleDropzoneAudit(file: typeof mockDroppedFile): BillForensicsResult {
      assertTrue(file.base64Data.startsWith('data:image/jpeg;base64,'));
      return createMockVietQRReceipt({
        isAuthentic: true,
        confidenceScore: 0.96,
        reconciliationStatus: 'MATCHED'
      });
    }

    const auditResult = handleDropzoneAudit(mockDroppedFile);
    assertTrue(auditResult.isAuthentic);
    assertEqual(auditResult.reconciliationStatus, 'MATCHED');
    assertEqual(auditResult.recommendation, 'AUTO_APPROVE');
  });

  // --------------------------------------------------------------------------
  // C22: Product Studio Copy (F2) -> Social Media Post Templates (F16)
  // --------------------------------------------------------------------------
  test('C22: Product Studio Copy (F2) -> Social Media Post Templates (F16)', () => {
    const marketingPack = createMockProductMarketingPack();

    // Template formatter conforming to SUBMISSION_GUIDE specifications
    const formattedFacebookPost = `
${marketingPack.channelCopies.facebook.headline}

${marketingPack.channelCopies.facebook.body}

${marketingPack.channelCopies.facebook.callToAction}

${marketingPack.channelCopies.facebook.hashtags.join(' ')}
    `.trim();

    assertContains(formattedFacebookPost, 'NÉT ĐẸP DI SẢN');
    assertContains(formattedFacebookPost, '#SMEAutoPilot');
    assertContains(formattedFacebookPost, '#AoDaiVietNam');
  });

  // --------------------------------------------------------------------------
  // C23: Cloud Run Health Probe (F15) -> Backend /healthz (F9)
  // --------------------------------------------------------------------------
  test('C23: Cloud Run Health Probe (F15) -> Backend /healthz (F9)', () => {
    const healthStatus: HealthStatus = {
      status: 'healthy',
      version: '1.0.0',
      uptimeSeconds: 1420,
      environment: 'production',
      timestamp: new Date().toISOString(),
      services: {
        gemini: 'operational',
        sheets: 'operational',
        gmail: 'operational',
        calendar: 'operational',
        maps: 'operational',
        firebase: 'operational'
      },
      mode: 'DEMO'
    };

    assertEqual(healthStatus.status, 'healthy');
    assertEqual(healthStatus.services.gemini, 'operational');
    assertEqual(healthStatus.services.sheets, 'operational');
    assertEqual(healthStatus.mode, 'DEMO');
  });

  // --------------------------------------------------------------------------
  // C24: Multi-Stop Dispatch (F6) -> Gmail Driver Manifest (F5)
  // --------------------------------------------------------------------------
  test('C24: Multi-Stop Dispatch (F6) -> Gmail Driver Manifest (F5)', async () => {
    const stops = [
      '45 Tràng Tiền, Hoàn Kiếm, Hà Nội',
      '12 Bà Triệu, Hai Bà Trưng, Hà Nội',
      '88 Cầu Giấy, Cầu Giấy, Hà Nội'
    ];

    const optimizedRoute = await mapsService.optimizeDeliveryRoute('18 Hàng Gai, Hoàn Kiếm', stops);
    const driverEmail = 'driver.nguyen@smeautopilot.vn';
    const manifestHtml = `<div>Lộ trình giao hàng: ${optimizedRoute.totalDistanceKm}km, ${optimizedRoute.optimizedStops.length} điểm.</div>`;

    const sendRes = await gmailService.sendDriverManifest(driverEmail, manifestHtml, optimizedRoute.optimizedStops.length);

    assertEqual(sendRes.status, 'SENT');
    const outbox = await gmailService.getOutbox();
    const driverEmailRecord = outbox.find(e => e.recipient === driverEmail);
    assertDefined(driverEmailRecord);
    assertContains(driverEmailRecord.subject, '3 điểm giao');
  });

  // --------------------------------------------------------------------------
  // C25: End-to-End Order Lifecycle (F3 -> F1 -> F4 -> F5 -> F6 -> F11)
  // --------------------------------------------------------------------------
  test('C25: End-to-End Order Lifecycle: Voice (F3) -> Audit (F1) -> Sheets (F4) -> Gmail (F5) -> Maps (F6) -> Dashboard (F11)', async () => {
    // Step 1: Voice Order Ingestion (F3)
    const orderId = 'ORD-E2E-2026-999';
    const initialStock = 25;
    const orderQuantity = 2;
    const unitPrice = 450000;
    const itemsSubtotal = orderQuantity * unitPrice; // 900,000 VND

    // Step 2: Shipping calculation via Maps (F6)
    const shipping = await mapsService.calculateDistance('18 Hàng Gai, Hoàn Kiếm', '45 Tràng Tiền, Hoàn Kiếm');
    const totalAmount = itemsSubtotal + shipping.shippingRateVnd; // 922,000 VND

    // Step 3: Stock Reservation & Order Creation in Google Sheets (F4)
    await sheetsService.updateInventoryStock('AD-LUA-HD-RED-L', -orderQuantity);
    const order: Order = createMockOrder({
      orderId,
      customerName: 'Hoàng Lan Anh',
      customerPhone: '0918273645',
      deliveryAddress: '45 Tràng Tiền, Hoàn Kiếm, Hà Nội',
      items: [{
        sku: 'AD-LUA-HD-RED-L',
        name: 'Áo Dài Lụa Hà Đông Đỏ L',
        quantity: orderQuantity,
        unitPrice,
        subtotal: itemsSubtotal
      }],
      itemsSubtotal,
      shippingFee: shipping.shippingRateVnd,
      totalAmount,
      paymentStatus: 'PENDING',
      orderStatus: 'DRAFT'
    });
    await sheetsService.appendOrder(order);

    // Step 4: VietQR Slip Submission & Forensics Audit (F1)
    const receipt = createMockVietQRReceipt({
      matchedOrderId: orderId,
      extractedData: {
        amount: totalAmount,
        transactionId: 'FT24081499991234',
        bankName: 'Vietcombank',
        accountNumber: '1029384756',
        accountHolder: 'HOANG LAN ANH',
        currency: 'VND',
        transactionTime: '2026-08-14 11:30:00',
        transferContent: `${orderId} Hoang Lan Anh`
      }
    });

    assertEqual(receipt.recommendation, 'AUTO_APPROVE');
    assertEqual(receipt.isAuthentic, true);

    // Step 5: Update Order Status in Sheets (F4)
    await sheetsService.updateOrderStatus(orderId, 'CONFIRMED', 'VERIFIED', receipt.extractedData.transactionId);

    // Step 6: Dispatch Invoice & Confirmation via Gmail (F5)
    const emailRes = await gmailService.sendInvoiceEmail('lananh.hoang@gmail.com', order);
    assertEqual(emailRes.status, 'SENT');

    // Step 7: Record Audit Trail (F7)
    await auditService.recordAuditLog({
      action: 'ORDER_SYNCED',
      actorId: 'system_autopilot',
      details: { orderId, totalAmount, status: 'CONFIRMED' },
      status: 'SUCCESS'
    });

    // Step 8: Verify Final Dashboard State (F11)
    const allOrders = await sheetsService.getOrders();
    const confirmedOrders = allOrders.filter(o => o.orderStatus === 'CONFIRMED');
    const totalGmv = confirmedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const updatedStock = await sheetsService.getInventoryItem('AD-LUA-HD-RED-L');

    assertEqual(confirmedOrders.length, 1);
    assertEqual(totalGmv, 922000);
    assertEqual(updatedStock!.stock, initialStock - orderQuantity);
  });
});
