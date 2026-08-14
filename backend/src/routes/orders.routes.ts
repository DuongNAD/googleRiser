/**
 * SME AutoPilot — Order Management Convenience REST Routes
 * backend/src/routes/orders.routes.ts
 */

import { Router, Request, Response } from 'express';
import { getGoogleFactory } from '../google/factory';
import { ApiResponse, Order } from '../../../shared';

export const ordersRouter = Router();

// GET /api/orders
ordersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
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
      error: { code: 'ORDERS_FETCH_ERROR', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// GET /api/orders/:id
ordersRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
    const factory = getGoogleFactory();
    const sheets = factory.getSheetsService();

    if (sheets.getOrderById) {
      const order = await sheets.getOrderById(orderId);
      if (!order) {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` },
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }
      res.status(200).json({ success: true, data: order, timestamp: new Date().toISOString() } as ApiResponse);
      return;
    }

    const orders = await sheets.getOrders();
    const order = orders.find(o => o.orderId === orderId);
    if (!order) {
      res.status(404).json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` },
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }

    res.status(200).json({ success: true, data: order, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'ORDER_FETCH_ERROR', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// POST /api/orders
ordersRouter.post('/', async (req: Request, res: Response): Promise<void> => {
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

// PATCH /api/orders/:id/status
ordersRouter.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
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
