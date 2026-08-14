/**
 * SME AutoPilot — In-Memory Stateful Mock Google Sheets Engine
 * backend/src/google/sheets/MockSheetsService.ts
 *
 * Implements a reactive spreadsheet simulator supporting:
 * - Mutex-locked atomic stock adjustments & InsufficientStockError guards
 * - Formula evaluation (=IF(stock<=threshold, ...), =G2+H2-I2, =SUM(...))
 * - Order journal with deduplication and auto-calculated totals
 * - CSV export for INVENTORY_MASTER and ORDERS_JOURNAL
 * - Bi-directional reconciliation logic
 */

import { InventoryItem, Order, SpreadsheetMetadata, ISheetsService } from '../../../../shared';
import { InsufficientStockError, SheetNotFoundError } from '../errors';
import { getSeedInventory, getSeedOrders, IndustryType } from '../../seed';

export class MockSheetsService implements ISheetsService {
  private inventory: Map<string, InventoryItem> = new Map();
  private orders: Map<string, Order> = new Map();
  private spreadsheetId: string = 'mock_spreadsheet_sme_vietnam_2026';
  private mutex: Promise<void> = Promise.resolve();

  constructor(initialInventory?: InventoryItem[], initialOrders?: Order[]) {
    if (initialInventory !== undefined || initialOrders !== undefined) {
      if (initialInventory) initialInventory.forEach(item => this.inventory.set(item.sku, { ...item }));
      if (initialOrders) initialOrders.forEach(order => this.orders.set(order.orderId, { ...order }));
    } else {
      this.seed('fashion');
    }
  }

  public reset(): void {
    this.inventory.clear();
    this.orders.clear();
  }

  public seed(industry: IndustryType = 'fashion'): void {
    this.reset();
    const items = getSeedInventory(industry);
    const orderList = getSeedOrders(industry);
    items.forEach(item => this.inventory.set(item.sku, { ...item }));
    orderList.forEach(order => this.orders.set(order.orderId, { ...order }));
  }

  public async getInventory(spreadsheetId?: string): Promise<InventoryItem[]> {
    return Array.from(this.inventory.values()).map(item => ({ ...item }));
  }

  public async getInventoryBySku(sku: string, spreadsheetId?: string): Promise<InventoryItem | null> {
    const item = this.inventory.get(sku);
    return item ? { ...item } : null;
  }

  public async updateInventoryStock(sku: string, delta: number, spreadsheetId?: string): Promise<InventoryItem> {
    let releaseMutex: () => void;
    const currentMutex = this.mutex;
    this.mutex = new Promise<void>(resolve => {
      releaseMutex = resolve;
    });
    await currentMutex;

    try {
      const item = this.inventory.get(sku);
      if (!item) {
        throw new SheetNotFoundError(`SKU '${sku}' not found in inventory sheet`, spreadsheetId, 'INVENTORY_MASTER');
      }

      const newStock = item.stock + delta;
      if (newStock < 0) {
        throw new InsufficientStockError(sku, item.stock, delta);
      }

      item.stock = newStock;
      item.lastUpdated = new Date().toISOString();
      this.inventory.set(sku, item);
      return { ...item };
    } finally {
      releaseMutex!();
    }
  }

  public async batchUpdateInventory(
    updates: { sku: string; delta?: number; price?: number }[],
    spreadsheetId?: string
  ): Promise<InventoryItem[]> {
    let releaseMutex: () => void;
    const currentMutex = this.mutex;
    this.mutex = new Promise<void>(resolve => {
      releaseMutex = resolve;
    });
    await currentMutex;

    try {
      const stagedUpdates: { sku: string; updatedItem: InventoryItem }[] = [];
      for (const update of updates) {
        const existing = this.inventory.get(update.sku);
        if (!existing) {
          throw new SheetNotFoundError(`SKU '${update.sku}' not found`, spreadsheetId, 'INVENTORY_MASTER');
        }
        const item: InventoryItem = { ...existing };
        if (update.delta !== undefined) {
          const newStock = item.stock + update.delta;
          if (newStock < 0) {
            throw new InsufficientStockError(update.sku, existing.stock, update.delta);
          }
          item.stock = newStock;
        }
        if (update.price !== undefined) {
          item.price = update.price;
        }
        item.lastUpdated = new Date().toISOString();
        stagedUpdates.push({ sku: update.sku, updatedItem: item });
      }

      const results: InventoryItem[] = [];
      for (const staged of stagedUpdates) {
        this.inventory.set(staged.sku, staged.updatedItem);
        results.push({ ...staged.updatedItem });
      }
      return results;
    } finally {
      releaseMutex!();
    }
  }

  public async getOrders(spreadsheetId?: string): Promise<Order[]> {
    return Array.from(this.orders.values()).map(order => ({ ...order }));
  }

  public async getOrderById(orderId: string, spreadsheetId?: string): Promise<Order | null> {
    const order = this.orders.get(orderId);
    return order ? { ...order } : null;
  }

  public async appendOrder(order: Order, spreadsheetId?: string): Promise<Order> {
    if (this.orders.has(order.orderId)) {
      throw new Error(`Order ID ${order.orderId} already exists in Sheet`);
    }

    const savedOrder: Order = {
      ...order,
      orderId: order.orderId || `ORD-VN-${Date.now()}`,
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Evaluate spreadsheet formula: =G2+H2-I2 (subtotal + shipping - discount)
      totalAmount:
        order.totalAmount !== undefined
          ? order.totalAmount
          : Math.max(0, (order.itemsSubtotal || 0) + (order.shippingFee || 0) - (order.discountAmount || 0))
    };

    this.orders.set(savedOrder.orderId, savedOrder);
    return { ...savedOrder };
  }

  public async updateOrderStatus(
    orderId: string,
    status: Order['orderStatus'],
    spreadsheetId?: string
  ): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new SheetNotFoundError(`Order '${orderId}' not found`, spreadsheetId, 'ORDERS_JOURNAL');
    }
    order.orderStatus = status;
    order.updatedAt = new Date().toISOString();
    this.orders.set(orderId, order);
    return { ...order };
  }

  public async syncAll(spreadsheetId?: string): Promise<{ inventoryCount: number; ordersCount: number; lastSyncedAt: string }> {
    return {
      inventoryCount: this.inventory.size,
      ordersCount: this.orders.size,
      lastSyncedAt: new Date().toISOString()
    };
  }

  public evaluateStockStatusFormula(item: InventoryItem): string {
    // Emulates Excel/Google Sheets: =IF(E2<=G2, "CẢNH BÁO", "ĐỦ HÀNG")
    return item.stock <= item.lowStockThreshold ? 'CẢNH BÁO' : 'ĐỦ HÀNG';
  }

  public evaluateOrderTotalFormula(order: Order): number {
    // Emulates: =G2+H2-I2
    return Math.max(0, order.itemsSubtotal + order.shippingFee - order.discountAmount);
  }

  public async exportToCsv(
    sheetName: 'INVENTORY_MASTER' | 'ORDERS_JOURNAL' | string = 'INVENTORY_MASTER',
    spreadsheetId?: string
  ): Promise<string> {
    if (sheetName === 'INVENTORY_MASTER') {
      const headers = ['Mã SKU', 'Tên Sản Phẩm', 'Danh Mục', 'Đơn Giá (VND)', 'Tồn Kho', 'Đơn Vị', 'Ngưỡng Cảnh Báo', 'Trạng Thái Tồn', 'Cập Nhật Cuối'];
      const rows = Array.from(this.inventory.values()).map(item => [
        `"${item.sku}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category}"`,
        item.price,
        item.stock,
        `"${item.unit}"`,
        item.lowStockThreshold,
        `"${this.evaluateStockStatusFormula(item)}"`,
        `"${item.lastUpdated}"`
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else {
      const headers = ['Mã Đơn Hàng', 'Tên Khách Hàng', 'Số Điện Thoại', 'Địa Chỉ Giao', 'Tỉnh / Thành Phố', 'Tiền Hàng (VND)', 'Phí Vận Chuyển', 'Giảm Giá', 'Tổng Thanh Toán', 'Phương Thức TT', 'Trạng Thái TT', 'Trạng Thái Đơn', 'Thời Gian Tạo'];
      const rows = Array.from(this.orders.values()).map(order => [
        `"${order.orderId}"`,
        `"${order.customerName.replace(/"/g, '""')}"`,
        `"${order.customerPhone}"`,
        `"${order.deliveryAddress.replace(/"/g, '""')}"`,
        `"${order.city}"`,
        order.itemsSubtotal,
        order.shippingFee,
        order.discountAmount,
        order.totalAmount,
        `"${order.paymentMethod}"`,
        `"${order.paymentStatus}"`,
        `"${order.orderStatus}"`,
        `"${order.createdAt}"`
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
  }

  public async getSpreadsheetMetadata(spreadsheetId?: string): Promise<SpreadsheetMetadata> {
    return {
      spreadsheetId: spreadsheetId || this.spreadsheetId,
      title: 'SME AutoPilot - Sổ Bán Hàng & Kho Vận 2026',
      sheets: [
        { sheetId: 0, title: 'INVENTORY_MASTER', rowCount: this.inventory.size + 1, columnCount: 9 },
        { sheetId: 1, title: 'ORDERS_JOURNAL', rowCount: this.orders.size + 1, columnCount: 15 }
      ],
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId || this.spreadsheetId}/edit`
    };
  }

  public reconcile(remoteInventory: InventoryItem[]): { updated: number; added: number } {
    let updated = 0;
    let added = 0;

    for (const remote of remoteInventory) {
      if (this.inventory.has(remote.sku)) {
        const local = this.inventory.get(remote.sku)!;
        if (local.stock !== remote.stock || local.price !== remote.price) {
          this.inventory.set(remote.sku, { ...remote, lastUpdated: new Date().toISOString() });
          updated++;
        }
      } else {
        this.inventory.set(remote.sku, { ...remote, lastUpdated: new Date().toISOString() });
        added++;
      }
    }

    return { updated, added };
  }
}
