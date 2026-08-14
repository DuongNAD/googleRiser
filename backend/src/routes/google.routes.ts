/**
 * SME AutoPilot — Google Cloud & Workspace Ecosystem SPI Routes
 * backend/src/routes/google.routes.ts
 */

import { Router, Request, Response } from 'express';
import { getGoogleFactory } from '../google/factory';
import { ApiResponse, Order, CalendarEventInput } from '../../../shared';

export const googleRouter = Router();

// ============================================================================
// 1. GOOGLE SHEETS API
// ============================================================================

// Inventory List & Query
googleRouter.get('/sheets/inventory', async (req: Request, res: Response): Promise<void> => {
  try {
    const factory = getGoogleFactory();
    const sheets = factory.getSheetsService();
    const sku = req.query.sku as string | undefined;

    if (sku && sheets.getInventoryBySku) {
      const item = await sheets.getInventoryBySku(sku);
      if (!item) {
        res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: `Inventory item with SKU '${sku}' not found` },
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }
      res.status(200).json({ success: true, data: item, timestamp: new Date().toISOString() } as ApiResponse);
      return;
    }

    const items = await sheets.getInventory();
    res.status(200).json({ success: true, data: items, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SHEETS_INVENTORY_ERROR', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Adjust Inventory Stock
googleRouter.post('/sheets/inventory/adjust', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sku, delta } = req.body;
    if (!sku || delta === undefined) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMETERS', message: 'sku and delta are required' },
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }

    const factory = getGoogleFactory();
    const sheets = factory.getSheetsService();
    const updated = await sheets.updateInventoryStock(sku, Number(delta));

    res.status(200).json({ success: true, data: updated, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { code: 'STOCK_UPDATE_FAILED', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Orders List & Query
googleRouter.get('/sheets/orders', async (req: Request, res: Response): Promise<void> => {
  try {
    const factory = getGoogleFactory();
    const sheets = factory.getSheetsService();
    const { orderStatus, paymentStatus, search } = req.query;

    let orders = await sheets.getOrders();

    if (orderStatus) {
      orders = orders.filter(o => o.orderStatus === orderStatus);
    }
    if (paymentStatus) {
      orders = orders.filter(o => o.paymentStatus === paymentStatus);
    }
    if (search) {
      const q = String(search).toLowerCase();
      orders = orders.filter(o =>
        o.orderId.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q)
      );
    }

    res.status(200).json({ success: true, data: orders, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SHEETS_ORDERS_ERROR', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Create / Append Order
googleRouter.post('/sheets/orders', async (req: Request, res: Response): Promise<void> => {
  try {
    const orderData = req.body as Order;
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ORDER', message: 'Order must contain items' },
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }

    const factory = getGoogleFactory();
    const sheets = factory.getSheetsService();
    const created = await sheets.appendOrder(orderData);

    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { code: 'ORDER_CREATION_FAILED', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Update Order Status
googleRouter.patch('/sheets/orders/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
    const { orderStatus } = req.body;

    if (!orderStatus) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'orderStatus is required' },
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }

    const factory = getGoogleFactory();
    const sheets = factory.getSheetsService();

    if (sheets.updateOrderStatus) {
      const updated = await sheets.updateOrderStatus(orderId, orderStatus);
      res.status(200).json({ success: true, data: updated, timestamp: new Date().toISOString() } as ApiResponse);
    } else {
      res.status(501).json({
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Status update not supported' },
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { code: 'ORDER_STATUS_UPDATE_FAILED', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Bi-directional Synchronization
googleRouter.post('/sheets/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const factory = getGoogleFactory();
    const sheets = factory.getSheetsService();
    const result = await sheets.syncAll();

    res.status(200).json({
      success: true,
      data: {
        ...result,
        lastSyncedAt: result.lastSyncedAt || new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SHEETS_SYNC_FAILED', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// ============================================================================
// 2. GMAIL API
// ============================================================================

// Send Invoice Email
googleRouter.post('/gmail/invoice', async (req: Request, res: Response): Promise<void> => {
  try {
    const { order, orderId, recipient, recipientEmail, items, totalAmount, customerName } = req.body;
    const effectiveRecipient = recipient || recipientEmail || 'customer@example.com';

    const effectiveOrder: Order = order || {
      orderId: orderId || `ORD-${Date.now()}`,
      customerName: customerName || 'Quý Khách Hàng',
      customerPhone: '0901234567',
      deliveryAddress: 'Hà Nội',
      city: 'Hanoi',
      items: items || [{ sku: 'SKU-001', name: 'Sản phẩm demo', quantity: 1, unitPrice: totalAmount || 100000, subtotal: totalAmount || 100000 }],
      itemsSubtotal: totalAmount || 100000,
      shippingFee: 0,
      discountAmount: 0,
      totalAmount: totalAmount || 100000,
      paymentMethod: 'VIETQR_NAPAS',
      paymentStatus: 'PAID',
      orderStatus: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const factory = getGoogleFactory();
    const gmail = factory.getGmailService();
    const result = await gmail.sendInvoiceEmail(effectiveRecipient, effectiveOrder);

    res.status(200).json({
      success: true,
      data: {
        ...result,
        recipient: effectiveRecipient,
        orderId: effectiveOrder.orderId
      },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { code: 'GMAIL_SEND_FAILED', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Get Gmail Outbox
googleRouter.get('/gmail/outbox', async (req: Request, res: Response): Promise<void> => {
  try {
    const { recipient, emailType, orderId } = req.query;
    const factory = getGoogleFactory();
    const gmail = factory.getGmailService();

    const emails = await gmail.getOutbox({
      recipient: recipient as string,
      emailType: emailType as string,
      orderId: orderId as string
    });

    res.status(200).json({ success: true, data: emails, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GMAIL_OUTBOX_ERROR', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// ============================================================================
// 3. GOOGLE CALENDAR API
// ============================================================================

// List Calendar Events
googleRouter.get('/calendar/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeMin, timeMax, eventType } = req.query;
    const factory = getGoogleFactory();
    const calendar = factory.getCalendarService();

    const events = await calendar.listEvents(
      timeMin as string,
      timeMax as string,
      eventType as string
    );

    res.status(200).json({ success: true, data: events, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'CALENDAR_EVENTS_ERROR', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Create Calendar Event
googleRouter.post('/calendar/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      summary,
      startTime,
      startDateTime,
      endTime,
      endDateTime,
      description = '',
      location,
      eventType = 'LIVESTREAM_SALES',
      attendees,
      remindersMinutesBefore
    } = req.body;

    const eventInput: CalendarEventInput = {
      summary: title || summary || 'Sự kiện bán hàng SME',
      description: description || '',
      startDateTime: startDateTime || startTime || new Date().toISOString(),
      endDateTime: endDateTime || endTime || new Date(Date.now() + 3600000).toISOString(),
      location,
      eventType,
      attendees,
      remindersMinutesBefore
    };

    const factory = getGoogleFactory();
    const calendar = factory.getCalendarService();
    const created = await calendar.createEvent(eventInput);

    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { code: 'CALENDAR_CREATE_FAILED', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// ============================================================================
// 4. GOOGLE MAPS PLATFORM
// ============================================================================

// Distance & Motorbike Shipping Fee Calculation
googleRouter.post('/maps/distance', async (req: Request, res: Response): Promise<void> => {
  try {
    const { origin, destination } = req.body;
    if (!origin || !destination) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_LOCATIONS', message: 'origin and destination are required' },
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }

    const factory = getGoogleFactory();
    const maps = factory.getMapsService();
    const result = await maps.calculateDistance(origin, destination);

    res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { code: 'DISTANCE_CALCULATION_FAILED', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Route Optimization (2-Opt TSP)
const handleRouteOptimization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { depot = 'Hà Nội Depot', stops } = req.body;
    if (!stops || !Array.isArray(stops)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STOPS', message: 'stops must be an array' },
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }

    const factory = getGoogleFactory();
    const maps = factory.getMapsService();
    const result = await maps.optimizeDeliveryRoute(depot, stops);

    res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { code: 'ROUTE_OPTIMIZATION_FAILED', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
};

googleRouter.post('/maps/optimize-route', handleRouteOptimization);
googleRouter.post('/maps/route', handleRouteOptimization);

// Store Branches List
googleRouter.get('/maps/branches', async (req: Request, res: Response): Promise<void> => {
  try {
    const city = req.query.city as string | undefined;
    const factory = getGoogleFactory();
    const maps = factory.getMapsService();
    const branches = await maps.getStoreBranches(city);

    res.status(200).json({ success: true, data: branches, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'MAPS_BRANCHES_ERROR', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// ============================================================================
// 5. FIRESTORE & AUDIT LOGS
// ============================================================================

googleRouter.get('/firestore/audit-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const action = req.query.action as string | undefined;

    const factory = getGoogleFactory();
    const firestore = factory.getFirestoreService();

    let logs: any[] = [];
    if (firestore.getAuditLogs) {
      logs = await firestore.getAuditLogs(limit, action);
    } else {
      logs = await firestore.queryCollection('audit_logs', { limit });
    }

    res.status(200).json({ success: true, data: logs, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FIRESTORE_LOGS_ERROR', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// ============================================================================
// 6. SEED & RUNTIME MODE SWITCHING
// ============================================================================

googleRouter.post('/seed/switch-industry', async (req: Request, res: Response): Promise<void> => {
  try {
    const { industryId } = req.body;
    if (!industryId || !['fashion', 'fnb', 'cosmetics'].includes(industryId)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INDUSTRY', message: 'industryId must be one of: fashion, fnb, cosmetics' },
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }

    const factory = getGoogleFactory();
    const switchResult = factory.loadSeedData(industryId as 'fashion' | 'fnb' | 'cosmetics');
    (global as any).activeIndustry = industryId;

    res.status(200).json({
      success: true,
      data: {
        industryId,
        ...switchResult,
        switchedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INDUSTRY_SWITCH_FAILED', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

googleRouter.post('/mode/switch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { mode } = req.body;
    if (!mode || !['demo', 'live'].includes(String(mode).toLowerCase())) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_MODE', message: "mode must be 'demo' or 'live'" },
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }

    const factory = getGoogleFactory();
    factory.setMode(mode);

    res.status(200).json({
      success: true,
      data: {
        mode: factory.getMode(),
        status: factory.getStatus ? factory.getStatus() : { mode: factory.getMode() }
      },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'MODE_SWITCH_FAILED', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});
