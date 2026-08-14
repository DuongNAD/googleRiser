/**
 * SME AutoPilot — Structured Error Hierarchy for Google Services
 * backend/src/google/errors.ts
 */

export class GoogleServiceError extends Error {
  public readonly service: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(service: string, message: string, statusCode: number = 500, details?: Record<string, any>) {
    super(`[${service}] ${message}`);
    this.name = 'GoogleServiceError';
    this.service = service;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InsufficientStockError extends GoogleServiceError {
  public readonly sku: string;
  public readonly currentStock: number;
  public readonly requestedDelta: number;

  constructor(sku: string, currentStock: number, requestedDelta: number) {
    super(
      'SheetsService',
      `Insufficient stock for SKU '${sku}': current stock is ${currentStock}, requested change is ${requestedDelta}`,
      400,
      { sku, currentStock, requestedDelta }
    );
    this.name = 'InsufficientStockError';
    this.sku = sku;
    this.currentStock = currentStock;
    this.requestedDelta = requestedDelta;
  }
}

export class SheetNotFoundError extends GoogleServiceError {
  public readonly spreadsheetId?: string;
  public readonly sheetName?: string;

  constructor(message: string, spreadsheetId?: string, sheetName?: string) {
    super('SheetsService', message, 404, { spreadsheetId, sheetName });
    this.name = 'SheetNotFoundError';
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;
  }
}

export class TransactionConflictError extends GoogleServiceError {
  public readonly collection?: string;
  public readonly docId?: string;

  constructor(message: string, collection?: string, docId?: string) {
    super('FirestoreService', message, 409, { collection, docId });
    this.name = 'TransactionConflictError';
    this.collection = collection;
    this.docId = docId;
  }
}

export class RouteOptimizationError extends GoogleServiceError {
  public readonly stopsCount?: number;

  constructor(message: string, stopsCount?: number) {
    super('MapsService', message, 400, { stopsCount });
    this.name = 'RouteOptimizationError';
    this.stopsCount = stopsCount;
  }
}

export class EmailDeliveryError extends GoogleServiceError {
  public readonly recipient: string;
  public readonly emailType?: string;

  constructor(recipient: string, message: string, emailType?: string) {
    super('GmailService', `Failed to send email to ${recipient}: ${message}`, 502, { recipient, emailType });
    this.name = 'EmailDeliveryError';
    this.recipient = recipient;
    this.emailType = emailType;
  }
}

export class CalendarEventError extends GoogleServiceError {
  public readonly eventId?: string;

  constructor(message: string, eventId?: string) {
    super('CalendarService', message, 400, { eventId });
    this.name = 'CalendarEventError';
    this.eventId = eventId;
  }
}

export class FirestoreError extends GoogleServiceError {
  public readonly operation: string;
  public readonly collectionName: string;
  public readonly docId?: string;

  constructor(operation: string, collectionName: string, message: string, docId?: string) {
    super('FirestoreService', `Firestore ${operation} on '${collectionName}' failed: ${message}`, 500, {
      operation,
      collectionName,
      docId
    });
    this.name = 'FirestoreError';
    this.operation = operation;
    this.collectionName = collectionName;
    this.docId = docId;
  }
}

export class CredentialMissingError extends GoogleServiceError {
  public readonly credentialKey: string;

  constructor(service: string, credentialKey: string) {
    super(
      service,
      `Missing required credential '${credentialKey}' for live integration. Please configure environment variables or use Demo/Mock mode.`,
      401,
      { credentialKey }
    );
    this.name = 'CredentialMissingError';
    this.credentialKey = credentialKey;
  }
}

export class InvalidVietQRError extends GoogleServiceError {
  public readonly payloadSnippet: string;

  constructor(message: string, payloadSnippet: string = '') {
    super('VietQR', `Invalid VietQR payload: ${message}`, 400, { payloadSnippet });
    this.name = 'InvalidVietQRError';
    this.payloadSnippet = payloadSnippet;
  }
}
