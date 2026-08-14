/**
 * SME AutoPilot — Google Sheets Service Types
 * backend/src/google/sheets/types.ts
 */

import { InventoryItem, Order, SpreadsheetMetadata, ISheetsService } from '../../../../shared';

export interface SheetRowData {
  range: string;
  values: any[][];
}

export interface SheetsSyncResult {
  inventoryCount: number;
  ordersCount: number;
  lastSyncedAt: string;
}

export { ISheetsService, InventoryItem, Order, SpreadsheetMetadata };
