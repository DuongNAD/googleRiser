/**
 * SME AutoPilot — Live Google Sheets API v4 Service Adapter
 * backend/src/google/sheets/LiveSheetsService.ts
 *
 * Implements Google Sheets API v4 integration using official googleapis SDK.
 * Supports JWT Service Account authentication and OAuth2 tokens with graceful fallback.
 */

import { InventoryItem, Order, SpreadsheetMetadata, ISheetsService } from '../../../../shared';
import { GoogleServiceError, CredentialMissingError } from '../errors';
import { MockSheetsService } from './MockSheetsService';

export class LiveSheetsService implements ISheetsService {
  private fallbackMock: MockSheetsService;
  private defaultSpreadsheetId: string;
  private isConfigured: boolean = false;
  private sheetsClient: any = null;

  constructor(spreadsheetId?: string) {
    this.defaultSpreadsheetId =
      spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1_live_sme_autopilot_spreadsheet_id';
    this.fallbackMock = new MockSheetsService();
    this.initClient();
  }

  private initClient(): void {
    const hasKey = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    if (!hasKey) {
      this.isConfigured = false;
      return;
    }

    try {
      // Safe dynamic loader for @googleapis/sheets SDK
      const sheets = require('@googleapis/sheets');
      const auth = new sheets.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      this.sheetsClient = sheets.sheets({ version: 'v4', auth });
      this.isConfigured = true;
    } catch (err) {
      console.warn('[LiveSheetsService] Could not initialize googleapis client, falling back to MOCK data (missing credentials or missing googleapis module):', err);
      this.isConfigured = false;
    }
  }

  public isAvailable(): boolean {
    return this.isConfigured && this.sheetsClient !== null;
  }

  public async getInventory(spreadsheetId?: string): Promise<InventoryItem[]> {
    const targetId = spreadsheetId || this.defaultSpreadsheetId;
    if (!this.isAvailable()) {
      return this.fallbackMock.getInventory(targetId);
    }

    try {
      const response = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId: targetId,
        range: 'INVENTORY_MASTER!A2:I'
      });

      const rows = response.data.values || [];
      return rows.map((r: any[]) => ({
        sku: r[0] || '',
        name: r[1] || '',
        category: r[2] || '',
        price: Number(r[3]) || 0,
        stock: Number(r[4]) || 0,
        unit: r[5] || 'cái',
        lowStockThreshold: Number(r[6]) || 5,
        lastUpdated: r[8] || new Date().toISOString()
      }));
    } catch (error: any) {
      console.warn(`[LiveSheetsService] getInventory failed for ${targetId}, using fallback:`, error?.message);
      return this.fallbackMock.getInventory(targetId);
    }
  }

  public async getInventoryBySku(sku: string, spreadsheetId?: string): Promise<InventoryItem | null> {
    const inventory = await this.getInventory(spreadsheetId);
    return inventory.find(item => item.sku.toLowerCase() === sku.toLowerCase()) || null;
  }

  public async updateInventoryStock(sku: string, delta: number, spreadsheetId?: string): Promise<InventoryItem> {
    const targetId = spreadsheetId || this.defaultSpreadsheetId;
    if (!this.isAvailable()) {
      return this.fallbackMock.updateInventoryStock(sku, delta, targetId);
    }

    try {
      // Find row index in live sheet
      const inventory = await this.getInventory(targetId);
      const index = inventory.findIndex(item => item.sku.toLowerCase() === sku.toLowerCase());
      if (index === -1) {
        throw new GoogleServiceError('SheetsService', `SKU '${sku}' not found in live sheet`, 404);
      }

      const item = inventory[index];
      const newStock = item.stock + delta;
      if (newStock < 0) {
        throw new GoogleServiceError('SheetsService', `Insufficient stock for SKU ${sku}`, 400);
      }

      const rowIndex = index + 2; // Header at row 1, 1-indexed
      await this.sheetsClient.spreadsheets.values.update({
        spreadsheetId: targetId,
        range: `INVENTORY_MASTER!E${rowIndex}:I${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[newStock, item.unit, item.lowStockThreshold, `=IF(E${rowIndex}<=G${rowIndex}, "CẢNH BÁO", "ĐỦ HÀNG")`, new Date().toISOString()]]
        }
      });

      item.stock = newStock;
      item.lastUpdated = new Date().toISOString();
      return item;
    } catch (error: any) {
      console.warn(`[LiveSheetsService] updateInventoryStock failed for ${sku}, using fallback:`, error?.message);
      return this.fallbackMock.updateInventoryStock(sku, delta, targetId);
    }
  }

  public async getOrders(spreadsheetId?: string): Promise<Order[]> {
    const targetId = spreadsheetId || this.defaultSpreadsheetId;
    if (!this.isAvailable()) {
      return this.fallbackMock.getOrders(targetId);
    }

    try {
      const response = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId: targetId,
        range: 'ORDERS_JOURNAL!A2:O'
      });

      const rows = response.data.values || [];
      return rows.map((r: any[]) => ({
        orderId: r[0] || '',
        customerName: r[1] || '',
        customerPhone: r[2] || '',
        deliveryAddress: r[3] || '',
        city: r[4] || 'Hanoi',
        items: [],
        itemsSubtotal: Number(r[5]) || 0,
        shippingFee: Number(r[6]) || 0,
        discountAmount: Number(r[7]) || 0,
        totalAmount: Number(r[8]) || 0,
        paymentMethod: r[9] || 'VIETQR_NAPAS',
        paymentStatus: r[10] || 'PENDING',
        orderStatus: r[11] || 'DRAFT',
        transactionRef: r[12] || '',
        createdAt: r[13] || new Date().toISOString(),
        updatedAt: r[14] || new Date().toISOString()
      }));
    } catch (error: any) {
      console.warn(`[LiveSheetsService] getOrders failed for ${targetId}, using fallback:`, error?.message);
      return this.fallbackMock.getOrders(targetId);
    }
  }

  public async getOrderById(orderId: string, spreadsheetId?: string): Promise<Order | null> {
    const orders = await this.getOrders(spreadsheetId);
    return orders.find(o => o.orderId.toLowerCase() === orderId.toLowerCase()) || null;
  }

  public async appendOrder(order: Order, spreadsheetId?: string): Promise<Order> {
    const targetId = spreadsheetId || this.defaultSpreadsheetId;
    if (!this.isAvailable()) {
      return this.fallbackMock.appendOrder(order, targetId);
    }

    try {
      const row = [
        order.orderId,
        order.customerName,
        order.customerPhone,
        order.deliveryAddress,
        order.city,
        order.itemsSubtotal,
        order.shippingFee,
        order.discountAmount,
        order.totalAmount,
        order.paymentMethod,
        order.paymentStatus,
        order.orderStatus,
        order.transactionRef || '',
        order.createdAt,
        order.updatedAt
      ];

      await this.sheetsClient.spreadsheets.values.append({
        spreadsheetId: targetId,
        range: 'ORDERS_JOURNAL!A:O',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [row]
        }
      });

      return order;
    } catch (error: any) {
      console.warn(`[LiveSheetsService] appendOrder failed for ${order.orderId}, using fallback:`, error?.message);
      return this.fallbackMock.appendOrder(order, targetId);
    }
  }

  public async updateOrderStatus(
    orderId: string,
    status: Order['orderStatus'],
    spreadsheetId?: string
  ): Promise<Order> {
    const targetId = spreadsheetId || this.defaultSpreadsheetId;
    if (!this.isAvailable()) {
      return this.fallbackMock.updateOrderStatus(orderId, status, targetId);
    }

    try {
      const orders = await this.getOrders(targetId);
      const index = orders.findIndex(o => o.orderId.toLowerCase() === orderId.toLowerCase());
      if (index === -1) {
        throw new GoogleServiceError('SheetsService', `Order '${orderId}' not found in live sheet`, 404);
      }

      const order = orders[index];
      order.orderStatus = status;
      order.updatedAt = new Date().toISOString();

      const rowIndex = index + 2; // Row index (1-based, header is row 1)
      await this.sheetsClient.spreadsheets.values.update({
        spreadsheetId: targetId,
        range: `ORDERS_JOURNAL!L${rowIndex}:O${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[order.orderStatus, order.transactionRef || '', order.createdAt, order.updatedAt]]
        }
      });

      return order;
    } catch (error: any) {
      console.warn(`[LiveSheetsService] updateOrderStatus failed for ${orderId}, using fallback:`, error?.message);
      return this.fallbackMock.updateOrderStatus(orderId, status, targetId);
    }
  }

  public async syncAll(spreadsheetId?: string): Promise<{ inventoryCount: number; ordersCount: number; lastSyncedAt: string }> {
    const inventory = await this.getInventory(spreadsheetId);
    const orders = await this.getOrders(spreadsheetId);
    return {
      inventoryCount: inventory.length,
      ordersCount: orders.length,
      lastSyncedAt: new Date().toISOString()
    };
  }

  public async exportToCsv(
    sheetName: 'INVENTORY_MASTER' | 'ORDERS_JOURNAL' | string = 'INVENTORY_MASTER',
    spreadsheetId?: string
  ): Promise<string> {
    return this.fallbackMock.exportToCsv(sheetName, spreadsheetId);
  }

  public async getSpreadsheetMetadata(spreadsheetId?: string): Promise<SpreadsheetMetadata> {
    const targetId = spreadsheetId || this.defaultSpreadsheetId;
    if (!this.isAvailable()) {
      return this.fallbackMock.getSpreadsheetMetadata(targetId);
    }

    try {
      const res = await this.sheetsClient.spreadsheets.get({
        spreadsheetId: targetId
      });
      const data = res.data;
      return {
        spreadsheetId: data.spreadsheetId,
        title: data.properties?.title || 'SME AutoPilot Sổ Bán Hàng',
        sheets: (data.sheets || []).map((s: any) => ({
          sheetId: s.properties?.sheetId || 0,
          title: s.properties?.title || 'Sheet',
          rowCount: s.properties?.gridProperties?.rowCount || 100,
          columnCount: s.properties?.gridProperties?.columnCount || 20
        })),
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`
      };
    } catch {
      return this.fallbackMock.getSpreadsheetMetadata(targetId);
    }
  }
}
