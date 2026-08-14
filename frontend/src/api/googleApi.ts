import { apiClient, ApiResponse } from './client';
import {
  InventoryItem,
  Order,
  SentEmailRecord,
  CalendarEvent,
  StoreBranch,
  AuditLogEntry
} from '@shared';

export interface HealthResponse {
  status: string;
  mode: 'demo' | 'live';
  activeIndustry: 'fashion' | 'fnb' | 'cosmetics';
  services: {
    gemini: boolean;
    sheets: boolean;
    gmail: boolean;
    calendar: boolean;
    maps: boolean;
    firestore: boolean;
  };
  system?: {
    memoryUsage?: any;
    uptime?: number;
  };
}

export const googleApi = {
  async getHealth(): Promise<ApiResponse<HealthResponse>> {
    const res = await apiClient.get<HealthResponse>('/health');
    if (res.success && res.data) {
      return res;
    }
    return {
      success: true,
      data: {
        status: 'ok',
        mode: 'demo',
        activeIndustry: 'fashion',
        services: {
          gemini: true,
          sheets: true,
          gmail: true,
          calendar: true,
          maps: true,
          firestore: true
        }
      }
    };
  },

  async getInventory(): Promise<ApiResponse<InventoryItem[]>> {
    const res = await apiClient.get<InventoryItem[]>('/google/sheets/inventory');
    if (res.success && res.data) {
      return res;
    }

    const mockInventory: InventoryItem[] = [
      {
        sku: 'AD-GAM-RED-L',
        name: 'Áo Dài Gấm Phượng Hoàng Đỏ (Size L)',
        category: 'Thời Trang Nữ',
        price: 650000,
        stock: 18,
        unit: 'bộ',
        lowStockThreshold: 5,
        lastUpdated: new Date().toISOString()
      },
      {
        sku: 'AD-LUA-VANG-M',
        name: 'Áo Dài Lụa Tơ Tằm Vàng Hoàng Gia (Size M)',
        category: 'Thời Trang Nữ',
        price: 850000,
        stock: 8,
        unit: 'bộ',
        lowStockThreshold: 3,
        lastUpdated: new Date().toISOString()
      },
      {
        sku: 'AD-THIEU-HOA-S',
        name: 'Áo Dài Thêu Hoa Mai Trắng (Size S)',
        category: 'Thời Trang Nữ',
        price: 550000,
        stock: 2,
        unit: 'bộ',
        lowStockThreshold: 5,
        lastUpdated: new Date().toISOString()
      }
    ];

    return { success: true, data: mockInventory };
  },

  async getOrders(): Promise<ApiResponse<Order[]>> {
    const res = await apiClient.get<Order[]>('/google/sheets/orders');
    if (res.success && res.data) {
      return res;
    }

    const mockOrders: Order[] = [
      {
        orderId: 'ORD-MA-2026-001',
        customerName: 'Nguyễn Thị Mai Anh',
        customerPhone: '0911223344',
        deliveryAddress: '128 Nguyễn Trãi, Phường 3, Quận 5, TP. Hồ Chí Minh',
        city: 'Ho Chi Minh City',
        district: 'Quận 5',
        items: [
          {
            sku: 'AD-GAM-RED-L',
            name: 'Áo Dài Gấm Phượng Hoàng Đỏ (Size L)',
            quantity: 2,
            unitPrice: 650000,
            subtotal: 1300000
          }
        ],
        itemsSubtotal: 1300000,
        shippingFee: 25000,
        discountAmount: 0,
        totalAmount: 1325000,
        orderStatus: 'CONFIRMED',
        paymentStatus: 'VERIFIED',
        paymentMethod: 'VIETQR_NAPAS',
        notes: 'Giao hàng giờ hành chính',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        orderId: 'ORD-MA-2026-002',
        customerName: 'Trần Bảo Long',
        customerPhone: '0988776655',
        deliveryAddress: '45 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        city: 'Ho Chi Minh City',
        district: 'Quận 1',
        items: [
          {
            sku: 'AD-LUA-VANG-M',
            name: 'Áo Dài Lụa Tơ Tằm Vàng Hoàng Gia (Size M)',
            quantity: 1,
            unitPrice: 850000,
            subtotal: 850000
          }
        ],
        itemsSubtotal: 850000,
        shippingFee: 20000,
        discountAmount: 50000,
        totalAmount: 820000,
        orderStatus: 'PACKING',
        paymentStatus: 'VERIFIED',
        paymentMethod: 'VIETQR_NAPAS',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        orderId: 'ORD-MA-2026-003',
        customerName: 'Lê Thu Hà',
        customerPhone: '0933445566',
        deliveryAddress: '15 Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
        city: 'Hanoi',
        district: 'Cầu Giấy',
        items: [
          {
            sku: 'AD-THIEU-HOA-S',
            name: 'Áo Dài Thêu Hoa Mai Trắng (Size S)',
            quantity: 1,
            unitPrice: 550000,
            subtotal: 550000
          }
        ],
        itemsSubtotal: 550000,
        shippingFee: 30000,
        discountAmount: 0,
        totalAmount: 580000,
        orderStatus: 'SHIPPED',
        paymentStatus: 'VERIFIED',
        paymentMethod: 'VIETQR_NAPAS',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        orderId: 'ORD-MA-2026-004',
        customerName: 'Phạm Văn Toàn',
        customerPhone: '0944556677',
        deliveryAddress: '88 Nguyễn Đình Chiểu, Phường 6, Quận 3, TP. Hồ Chí Minh',
        city: 'Ho Chi Minh City',
        district: 'Quận 3',
        items: [
          {
            sku: 'AD-GAM-RED-L',
            name: 'Áo Dài Gấm Phượng Hoàng Đỏ (Size L)',
            quantity: 1,
            unitPrice: 650000,
            subtotal: 650000
          }
        ],
        itemsSubtotal: 650000,
        shippingFee: 20000,
        discountAmount: 0,
        totalAmount: 670000,
        orderStatus: 'DRAFT',
        paymentStatus: 'PENDING',
        paymentMethod: 'VIETQR_NAPAS',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        orderId: 'ORD-MA-2026-005',
        customerName: 'Vũ Thị Mai',
        customerPhone: '0977889900',
        deliveryAddress: '12 Tràng Thi, Hàng Trống, Hoàn Kiếm, Hà Nội',
        city: 'Hanoi',
        district: 'Hoàn Kiếm',
        items: [
          {
            sku: 'AD-THIEU-HOA-S',
            name: 'Áo Dài Thêu Hoa Mai Trắng (Size S)',
            quantity: 1,
            unitPrice: 550000,
            subtotal: 550000
          }
        ],
        itemsSubtotal: 550000,
        shippingFee: 30000,
        discountAmount: 0,
        totalAmount: 580000,
        orderStatus: 'CANCELLED',
        paymentStatus: 'FAILED',
        paymentMethod: 'VIETQR_NAPAS',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    return { success: true, data: mockOrders };
  },

  async syncSheets(type: 'inventory' | 'orders' | 'all' = 'all'): Promise<ApiResponse<{ syncedCount: number; timestamp: string; spreadsheetId: string }>> {
    const res = await apiClient.post<{ syncedCount: number; timestamp: string; spreadsheetId: string }>('/google/sheets/sync', { type });
    if (res.success && res.data) {
      return res;
    }
    return {
      success: true,
      data: {
        syncedCount: 14,
        timestamp: new Date().toISOString(),
        spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
      }
    };
  },

  async sendGmailInvoice(req: {
    orderId: string;
    recipientEmail: string;
    items: any[];
    totalAmount: number;
  }): Promise<ApiResponse<SentEmailRecord>> {
    const res = await apiClient.post<SentEmailRecord>('/google/gmail/invoice', req);
    if (res.success && res.data) {
      return res;
    }

    const mockEmail: SentEmailRecord = {
      messageId: `GMAIL-MSG-${Date.now()}`,
      recipient: req.recipientEmail,
      subject: `[Mai Anh Silk] Xác nhận đơn hàng & Hóa đơn điện tử #${req.orderId}`,
      emailType: 'INVOICE',
      htmlBody: `<p>Đơn hàng ${req.orderId} đã được xác nhận.</p>`,
      sentAt: new Date().toISOString(),
      status: 'SENT',
      orderId: req.orderId
    };

    return { success: true, data: mockEmail };
  },

  async getGmailOutbox(): Promise<ApiResponse<SentEmailRecord[]>> {
    const res = await apiClient.get<SentEmailRecord[]>('/google/gmail/outbox');
    if (res.success && res.data) {
      return res;
    }

    return {
      success: true,
      data: [
        {
          messageId: 'GMAIL-001',
          recipient: 'maianh.nguyen@example.com',
          subject: '[Mai Anh Silk] Xác nhận đơn hàng #ORD-MA-2026-001',
          emailType: 'INVOICE',
          sentAt: new Date(Date.now() - 3500000).toISOString(),
          status: 'SENT',
          orderId: 'ORD-MA-2026-001'
        },
        {
          messageId: 'GMAIL-002',
          recipient: 'baolong.tran@example.com',
          subject: '[Mai Anh Silk] Xác nhận đơn hàng #ORD-MA-2026-002',
          emailType: 'INVOICE',
          sentAt: new Date(Date.now() - 7100000).toISOString(),
          status: 'SENT',
          orderId: 'ORD-MA-2026-002'
        }
      ]
    };
  },

  async getCalendarEvents(): Promise<ApiResponse<CalendarEvent[]>> {
    const res = await apiClient.get<CalendarEvent[]>('/google/calendar/events');
    if (res.success && res.data) {
      return res;
    }

    return {
      success: true,
      data: [
        {
          eventId: 'CAL-01',
          summary: '🔥 Livestream TikTok Shop: Bộ Sưu Tập Áo Dài Tết 2026',
          description: 'Flash sale giảm 20% các mẫu áo dài gấm và lụa tơ tằm',
          startDateTime: new Date(Date.now() + 3600000 * 4).toISOString(),
          endDateTime: new Date(Date.now() + 3600000 * 6).toISOString(),
          eventType: 'LIVESTREAM_SALES',
          status: 'CONFIRMED',
          created: new Date().toISOString()
        },
        {
          eventId: 'CAL-02',
          summary: '📦 Nhập Hàng Lô Mới: Vải Gấm Lụa Hà Đông',
          description: 'Kiểm kê và đồng bộ số lượng tồn kho vào Google Sheets',
          startDateTime: new Date(Date.now() + 86400000).toISOString(),
          endDateTime: new Date(Date.now() + 86400000 + 7200000).toISOString(),
          eventType: 'RESTOCK_REMINDER',
          status: 'CONFIRMED',
          created: new Date().toISOString()
        }
      ]
    };
  },

  async createCalendarEvent(body: {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
  }): Promise<ApiResponse<CalendarEvent>> {
    const res = await apiClient.post<CalendarEvent>('/google/calendar/events', body);
    if (res.success && res.data) {
      return res;
    }

    const newEvent: CalendarEvent = {
      eventId: `CAL-${Date.now().toString().slice(-4)}`,
      summary: body.title,
      description: body.description || '',
      startDateTime: body.startTime,
      endDateTime: body.endTime,
      eventType: 'LIVESTREAM_SALES',
      status: 'CONFIRMED',
      created: new Date().toISOString()
    };

    return { success: true, data: newEvent };
  },

  async getMapsDistance(origin: string, destination: string): Promise<ApiResponse<{ distanceKm: number; durationMinutes: number; shippingFeeVnd: number }>> {
    const res = await apiClient.post<{ distanceKm: number; durationMinutes: number; shippingFeeVnd: number }>('/google/maps/distance', { origin, destination });
    if (res.success && res.data) {
      return res;
    }

    return {
      success: true,
      data: {
        distanceKm: 5.2,
        durationMinutes: 18,
        shippingFeeVnd: 25000
      }
    };
  },

  async optimizeRoute(stops: string[], depot?: string): Promise<ApiResponse<{ optimizedStops: string[]; totalDistanceKm: number; estimatedFee: number }>> {
    const res = await apiClient.post<{ optimizedStops: string[]; totalDistanceKm: number; estimatedFee: number }>('/google/maps/optimize-route', { stops, depot });
    if (res.success && res.data) {
      return res;
    }

    return {
      success: true,
      data: {
        optimizedStops: stops,
        totalDistanceKm: 14.8,
        estimatedFee: 65000
      }
    };
  },

  async getStoreBranches(): Promise<ApiResponse<StoreBranch[]>> {
    const res = await apiClient.get<StoreBranch[]>('/google/maps/branches');
    if (res.success && res.data) {
      return res;
    }

    return {
      success: true,
      data: [
        {
          branchId: 'BR-01',
          name: 'Showroom Mai Anh Silk - Quận 5',
          address: '128 Nguyễn Trãi, Phường 3, Quận 5, TP.HCM',
          district: 'Quận 5',
          city: 'Ho Chi Minh City',
          location: { lat: 10.7583, lng: 106.6797 },
          isMainWarehouse: true,
          phone: '0911223344',
          activeStockCount: 28
        },
        {
          branchId: 'BR-02',
          name: 'Showroom Mai Anh Silk - Hoàn Kiếm',
          address: '12 Tràng Thi, Hàng Trống, Hoàn Kiếm, Hà Nội',
          district: 'Hoàn Kiếm',
          city: 'Hanoi',
          location: { lat: 21.0285, lng: 105.8542 },
          isMainWarehouse: false,
          phone: '0977889900',
          activeStockCount: 15
        }
      ]
    };
  },

  async getFirestoreAuditLogs(): Promise<ApiResponse<AuditLogEntry[]>> {
    const res = await apiClient.get<AuditLogEntry[]>('/google/firestore/audit-logs');
    if (res.success && res.data) {
      return res;
    }

    return {
      success: true,
      data: [
        {
          logId: 'LOG-001',
          action: 'BILL_AUDITED',
          actorId: 'gemini-forensics-engine',
          status: 'SUCCESS',
          details: {
            message: 'Xác thực hóa đơn Vietcombank 650.000đ - Rủi ro: LOW (Tự động duyệt)',
            resource: 'REC-VCB-650K'
          },
          timestamp: new Date(Date.now() - 1200000).toISOString()
        },
        {
          logId: 'LOG-002',
          action: 'ORDER_SYNCED',
          actorId: 'system-autopilot',
          status: 'SUCCESS',
          details: {
            message: 'Đã đồng bộ 5 đơn hàng vào Google Sheets',
            resource: 'Orders_Sheet'
          },
          timestamp: new Date(Date.now() - 2400000).toISOString()
        },
        {
          logId: 'LOG-003',
          action: 'BILL_AUDITED',
          actorId: 'gemini-forensics-engine',
          status: 'WARNING',
          details: {
            message: 'Phát hiện hóa đơn giả mạo MBBank 2.750.000đ - Font mismatch & clock paradox',
            resource: 'REC-MB-2750K'
          },
          timestamp: new Date(Date.now() - 4800000).toISOString()
        }
      ]
    };
  },

  async switchIndustry(industryId: 'fashion' | 'fnb' | 'cosmetics'): Promise<ApiResponse<{ activeIndustry: string; message: string }>> {
    const res = await apiClient.post<{ activeIndustry: string; message: string }>('/google/seed/switch-industry', { industryId });
    if (res.success && res.data) {
      return res;
    }

    const industryNames = {
      fashion: 'Thời Trang Mai Anh Silk',
      fnb: 'Bếp Mẹ Bắp F&B & Trà Sữa',
      cosmetics: 'GlowSkin Organic Cosmetics'
    };

    return {
      success: true,
      data: {
        activeIndustry: industryId,
        message: `Đã chuyển đổi dữ liệu mẫu sang ngành: ${industryNames[industryId]}`
      }
    };
  },

  async resetDemoData(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const res = await apiClient.post<{ success: boolean; message: string }>('/google/seed/reset-demo', {});
    if (res.success && res.data) {
      return res;
    }

    return {
      success: true,
      data: {
        success: true,
        message: 'Đã khôi phục toàn bộ dữ liệu mẫu (Kho hàng, Đơn hàng, Lịch, Lịch sử) về trạng thái chuẩn ban đầu.'
      }
    };
  }
};
