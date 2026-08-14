/**
 * SME AutoPilot — Inventory Management Convenience REST Routes
 * backend/src/routes/inventory.routes.ts
 */

import { Router, Request, Response } from 'express';
import { getGoogleFactory } from '../google/factory';
import { ApiResponse } from '../../../shared';

export const inventoryRouter = Router();

// GET /api/inventory
inventoryRouter.get('/', async (req: Request, res: Response): Promise<void> => {
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
      error: { code: 'INVENTORY_FETCH_ERROR', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// GET /api/inventory/:sku
inventoryRouter.get('/:sku', async (req: Request, res: Response): Promise<void> => {
  try {
    const sku = Array.isArray(req.params.sku) ? req.params.sku[0] : String(req.params.sku);
    const factory = getGoogleFactory();
    const sheets = factory.getSheetsService();

    if (sheets.getInventoryBySku) {
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
    const item = items.find(i => i.sku === sku);
    if (!item) {
      res.status(404).json({
        success: false,
        error: { code: 'ITEM_NOT_FOUND', message: `Inventory item with SKU '${sku}' not found` },
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }

    res.status(200).json({ success: true, data: item, timestamp: new Date().toISOString() } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INVENTORY_FETCH_ERROR', message: error.message },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// POST /api/inventory/stock & POST /api/inventory/adjust
const handleStockAdjust = async (req: Request, res: Response): Promise<void> => {
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
};

inventoryRouter.post('/stock', handleStockAdjust);
inventoryRouter.post('/adjust', handleStockAdjust);
