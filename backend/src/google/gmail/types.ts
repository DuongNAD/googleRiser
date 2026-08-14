/**
 * SME AutoPilot — Gmail Service Types
 * backend/src/google/gmail/types.ts
 */

import { SentEmailRecord, Order, TrackingInfo, InventoryItem, IGmailService } from '../../../../shared';

export interface EmailSendOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
}

export { SentEmailRecord, Order, TrackingInfo, InventoryItem, IGmailService };
