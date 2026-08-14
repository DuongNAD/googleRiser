/**
 * SME AutoPilot — Google Cloud & Workspace Ecosystem SPI Type Definitions
 * shared/types/google.ts
 *
 * Pluggable Service Provider Interface (SPI) contracts and DTOs for:
 * - Google Sheets API v4
 * - Gmail API v1
 * - Google Calendar API v3
 * - Google Maps Platform
 * - Firebase Firestore & Auth
 * - GoogleServiceFactory
 */

// ==========================================
// 1. DATA TRANSFER OBJECTS (DTOs)
// ==========================================

export interface InventoryItem {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  lowStockThreshold: number;
  lastUpdated: string;
  costPrice?: number;
  tags?: string[];
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  orderId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  city: 'Hanoi' | 'Da Nang' | 'Ho Chi Minh City' | string;
  district?: string;
  items: OrderItem[];
  itemsSubtotal: number;
  shippingFee: number;
  discountAmount: number;
  voucherCode?: string;
  totalAmount: number;
  paymentMethod: 'VIETQR_NAPAS' | 'COD' | 'BANK_TRANSFER' | string;
  paymentStatus: 'PENDING' | 'PAID' | 'VERIFIED' | 'FAILED';
  orderStatus: 'DRAFT' | 'CONFIRMED' | 'PACKING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  vietqrPayload?: string;
  transactionRef?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface TrackingInfo {
  trackingCode: string;
  orderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  shippingCarrier: string;
  originAddress: string;
  destinationAddress: string;
  currentStatus: 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED';
  estimatedDeliveryTime: string;
  driverNotes?: string;
}

export interface SentEmailRecord {
  messageId: string;
  recipient: string;
  recipientName?: string;
  subject: string;
  emailType: 'INVOICE' | 'SHIPPING_NOTIFICATION' | 'RESTOCK_ALERT' | 'PROMOTION';
  htmlBody?: string;
  sentAt: string;
  status: 'SENT' | 'QUEUED' | 'FAILED';
  orderId?: string;
  vietqrPayload?: string;
}

export interface CalendarEventInput {
  summary: string;
  description: string;
  startDateTime: string; // ISO 8601 string (e.g. 2026-08-14T19:30:00+07:00)
  endDateTime: string;   // ISO 8601 string
  location?: string;
  eventType: 'RESTOCK_REMINDER' | 'LIVESTREAM_SALES' | 'SUPPLIER_MEETING' | 'VIP_FITTING' | 'ORDER_PICKUP';
  attendees?: string[];
  remindersMinutesBefore?: number[];
}

export interface CalendarEvent extends CalendarEventInput {
  eventId: string;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  htmlLink?: string;
  iCalUID?: string;
  created: string;
  updated?: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export type VietnamShippingTier = 'STANDARD_INNER_CITY' | 'SUBURB' | 'INTER_PROVINCIAL' | 'EXPRESS';

export interface DistanceResult {
  origin: string;
  originLocation?: LatLng;
  destination: string;
  destinationLocation?: LatLng;
  distanceKm: number;
  durationMinutes: number;
  shippingRateVnd: number;
  rateTier: VietnamShippingTier;
  breakdown?: {
    baseRateVnd: number;
    extraDistanceRateVnd: number;
    peakHourSurchargeVnd: number;
  };
}

export interface RouteStopInput {
  orderId?: string;
  id?: string;
  address: string;
  location?: LatLng;
  customerName?: string;
  customerPhone?: string;
  district?: string;
  city?: string;
}

export interface OptimizedRouteStop {
  stopIndex: number;
  orderId: string;
  address: string;
  customerName: string;
  customerPhone: string;
  district?: string;
  location: LatLng;
  estimatedArrivalMinutes: number;
  distanceFromPreviousKm: number;
  cumulativeDistanceKm?: number;
}

export interface RouteOptimizationResult {
  depotAddress: string;
  depotLocation: LatLng;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  optimizedStops: OptimizedRouteStop[];
  totalOrders: number;
  efficiencyGainPercent?: number;
}

export interface StoreBranch {
  branchId: string;
  name: string;
  address: string;
  district: string;
  city: 'Hanoi' | 'Da Nang' | 'Ho Chi Minh City' | string;
  location: LatLng;
  phone: string;
  isMainWarehouse: boolean;
  activeStockCount: number;
}

export interface SheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: { sheetId: number; title: string; rowCount: number; columnCount: number }[];
  spreadsheetUrl: string;
}
export type SpreadsheetMetadata = SheetMetadata;

export interface SheetFormulaResult {
  formula: string;
  evaluatedValue: any;
}

export interface VietQRParams {
  bankBin: string;
  accountNumber: string;
  amount: number;
  memo: string;
  accountHolderName?: string;
}

// ==========================================
// 2. FIRESTORE QUERY & TRANSACTION CONTRACTS
// ==========================================

export interface QueryCondition {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in';
  value: any;
}

export interface FirestoreQueryOptions {
  where?: QueryCondition[];
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}
export type QueryOptions = FirestoreQueryOptions;

export interface FirestoreDocument<T = any> {
  id: string;
  data: T;
  createdAt?: string;
  updatedAt?: string;
}

export interface ITransactionContext {
  get<T>(collection: string, docId: string): Promise<T | null>;
  set<T>(collection: string, docId: string, data: T): void;
  update<T>(collection: string, docId: string, updates: Partial<T>): void;
  delete(collection: string, docId: string): void;
}
export type FirestoreTransaction = ITransactionContext;

// ==========================================
// 3. SERVICE PROVIDER INTERFACES (SPI)
// ==========================================

export interface ISheetsService {
  getInventory(spreadsheetId?: string): Promise<InventoryItem[]>;
  getInventoryBySku?(sku: string, spreadsheetId?: string): Promise<InventoryItem | null>;
  updateInventoryStock(sku: string, delta: number, spreadsheetId?: string): Promise<InventoryItem>;
  batchUpdateInventory?(updates: { sku: string; delta?: number; price?: number }[], spreadsheetId?: string): Promise<InventoryItem[]>;
  getOrders(spreadsheetId?: string): Promise<Order[]>;
  getOrderById?(orderId: string, spreadsheetId?: string): Promise<Order | null>;
  appendOrder(order: Order, spreadsheetId?: string): Promise<Order>;
  updateOrderStatus?(orderId: string, status: Order['orderStatus'], spreadsheetId?: string): Promise<Order>;
  syncAll(spreadsheetId?: string): Promise<{ inventoryCount: number; ordersCount: number; lastSyncedAt?: string }>;
  exportToCsv?(sheetName?: 'INVENTORY_MASTER' | 'ORDERS_JOURNAL' | string, spreadsheetId?: string): Promise<string>;
  getSpreadsheetMetadata?(spreadsheetId?: string): Promise<SpreadsheetMetadata>;
  reconcile?(remoteInventory: InventoryItem[]): { updated: number; added: number };
}

export interface IGmailService {
  sendInvoiceEmail(
    recipient: string,
    order: Order,
    invoiceHtml?: string,
    customSubject?: string
  ): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }>;
  sendShippingNotification(
    recipient: string,
    trackingInfo: TrackingInfo
  ): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }>;
  sendRestockAlert?(
    recipient: string,
    lowStockItems: InventoryItem[]
  ): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }>;
  getOutbox(filter?: { recipient?: string; emailType?: string; orderId?: string }): Promise<SentEmailRecord[]>;
  getEmailById?(messageId: string): Promise<SentEmailRecord | null>;
  clearOutbox?(): void;
}

export interface ICalendarService {
  createEvent(event: CalendarEventInput): Promise<CalendarEvent>;
  getEventById?(eventId: string): Promise<CalendarEvent | null>;
  listEvents(timeMin?: string, timeMax?: string, eventType?: string): Promise<CalendarEvent[]>;
  updateEvent?(eventId: string, updates: Partial<CalendarEventInput>): Promise<CalendarEvent>;
  deleteEvent?(eventId: string): Promise<{ success: boolean; eventId: string }>;
  exportEventToIcs?(eventId: string): Promise<string>;
  exportToICal?(): Promise<string>;
}

export interface IMapsService {
  calculateDistance(
    origin: LatLng | string,
    destination: LatLng | string,
    optionsOrParam?: any
  ): Promise<DistanceResult>;
  optimizeDeliveryRoute(
    depot: LatLng | string,
    stops: (LatLng | string | RouteStopInput | Order)[]
  ): Promise<RouteOptimizationResult>;
  getStoreBranches(cityFilter?: string): Promise<StoreBranch[]>;
  findNearestBranch?(
    customerLocation: LatLng | string
  ): any;
  geocodeAddress?(address: string, city?: string): Promise<LatLng>;
  geocode?(address: string): Promise<LatLng>;
}

export interface IFirestoreService {
  getDocument<T = any>(collectionName: string, docId: string): Promise<T | null>;
  getDoc?<T = any>(collectionName: string, docId: string): Promise<T | null>;
  setDocument<T = any>(collectionName: string, docId: string, data: T, merge?: boolean): Promise<void>;
  setDoc?<T = any>(collectionName: string, docId: string, data: T, merge?: boolean): Promise<void>;
  updateDoc?<T = any>(collectionName: string, docId: string, updates: Partial<T>): Promise<void>;
  deleteDoc?(collectionName: string, docId: string): Promise<void>;
  queryCollection<T = any>(
    collectionName: string,
    optionsOrFilter?: FirestoreQueryOptions | ((item: T) => boolean)
  ): Promise<T[]>;
  getAllDocs?<T = any>(collectionName: string): Promise<T[]>;
  saveAuditLog?(log: any): Promise<void>;
  logAuditEvent?(event: any): Promise<any>;
  getAuditLogs?(limitOrTenantId?: number | string, filterOrAction?: string): Promise<any[]>;
  getPromptTemplates?(tenantId?: string): Promise<any[]>;
  savePromptTemplate?(tenantId: string, template: any): Promise<any>;
  getPromptTemplate?(tenantId: string, templateId: string): Promise<any | null>;
  listPromptTemplates?(tenantId: string): Promise<any[]>;
  writeAuditLog?(tenantId: string, entry: any): Promise<any>;
  runTransaction?<T>(updateFunction: (transaction: ITransactionContext) => Promise<T>): Promise<T>;
  resetToSeedData?(): Promise<void>;
}

export type IntegrationMode = 'DEMO' | 'LIVE' | 'demo' | 'live';
export type AppMode = 'demo' | 'live';

export interface ServiceStatusSummary {
  mode: AppMode;
  sheets: { mode: AppMode; status: string };
  gmail: { mode: AppMode; status: string };
  calendar: { mode: AppMode; status: string };
  maps: { mode: AppMode; status: string };
  firestore: { mode: AppMode; status: string };
  credentialsConfigured: {
    googleAuth: boolean;
    googleMaps: boolean;
    firebase: boolean;
  };
}

export interface IGoogleServiceFactory {
  getSheetsService(mode?: string): ISheetsService;
  getGmailService(mode?: string): IGmailService;
  getCalendarService(mode?: string): ICalendarService;
  getMapsService(mode?: string): IMapsService;
  getFirestoreService(mode?: string): IFirestoreService;
  getMode(): string;
  setMode(mode: any): void;
  resolveMode?(mode?: string): AppMode;
  resetMockData?(): Promise<void> | void;
  resetAllMocks?(): void;
  seedAllMocks?(dataset?: 'fashion' | 'fnb' | 'cosmetics'): void;
  loadSeedData?(industry: 'fashion' | 'fnb' | 'cosmetics'): { category: string; shopName: string; itemCount: number };
  getStatus?(): ServiceStatusSummary;
}
