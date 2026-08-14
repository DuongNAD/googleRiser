/**
 * SME AutoPilot — In-Memory Stateful Mock Cloud Firestore NoSQL Engine
 * backend/src/google/firebase/MockFirestoreService.ts
 *
 * Implements:
 * - Collection-partitioned document store with deep cloning for immutability
 * - Complex query evaluator (compound `where`, `orderBy`, `limit`, `offset`)
 * - Atomic ACID Transaction Engine with Snapshot Isolation and rollback
 * - Forensic audit log trail and Gemini AI prompt template registry
 * - Multi-tenant isolation simulation
 */

import {
  QueryCondition,
  FirestoreQueryOptions,
  ITransactionContext,
  AuditLogEntry,
  PromptTemplate,
  User,
  ShopProfile,
  IFirestoreService
} from '../../../../shared';
import { FirestoreError, TransactionConflictError } from '../errors';
import { getSeedData, IndustryType } from '../../seed';

export class MockFirestoreService implements IFirestoreService {
  // collectionName -> (docId -> documentData)
  private store: Map<string, Map<string, any>> = new Map();
  private transactionMutex: Promise<void> = Promise.resolve();

  constructor() {
    this.seed('fashion');
  }

  private deepClone<T>(val: T): T {
    if (val === undefined || val === null) return val;
    return JSON.parse(JSON.stringify(val));
  }

  public reset(): void {
    this.store.clear();
  }

  public seed(industry: IndustryType = 'fashion'): void {
    this.reset();
    const data = getSeedData(industry);

    // Seed shop_profiles
    if (data.shopProfile) {
      this.setDocumentSync('shop_profiles', data.shopProfile.shopId, data.shopProfile);
    }

    // Seed inventory
    (data.inventory || []).forEach(item => {
      this.setDocumentSync('inventory', item.sku, item);
    });

    // Seed orders
    (data.orders || []).forEach(order => {
      this.setDocumentSync('orders', order.orderId, order);
    });

    // Seed default users
    const defaultUser: User = {
      uid: 'user_merchant_01',
      email: data.shopProfile.email || 'merchant@smeautopilot.vn',
      displayName: data.shopProfile.ownerName || 'Chủ Cửa Hàng',
      role: 'merchant',
      shopName: data.shopProfile.shopName,
      tier: 'pro',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    this.setDocumentSync('users', defaultUser.uid, defaultUser);

    // Seed default prompt templates
    const defaultPrompts: PromptTemplate[] = [
      {
        templateId: 'tmpl_product_copy_vn_01',
        title: 'Vietnamese Multi-Channel Copywriting Master',
        category: 'product_copy',
        systemInstruction:
          'Bạn là chuyên gia Marketing và Copywriting hàng đầu cho các sàn TMĐT tại Việt Nam (Shopee, TikTok Shop, Facebook, Zalo).',
        userPromptTemplate:
          'Hãy tạo nội dung bán hàng cho sản phẩm: {{productTitle}}, với các đặc điểm: {{attributes}} theo tông giọng {{tone}}.',
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        topP: 0.95,
        tags: ['vietnamese', 'ecommerce', 'multichannel', 'sme'],
        isCustom: false
      },
      {
        templateId: 'tmpl_forensics_audit_vn_02',
        title: 'VietQR & Bank Bill Forensics Validator',
        category: 'forensics_audit',
        systemInstruction:
          'Bạn là chuyên gia giám định hóa đơn chuyển khoản ngân hàng Việt Nam (NAPAS 247, Vietcombank, Techcombank, MBBank).',
        userPromptTemplate: 'Phân tích tính xác thực của biên lai chuyển khoản ngân hàng: {{rawOcrText}}.',
        model: 'gemini-2.0-flash',
        temperature: 0.1,
        tags: ['forensics', 'banking', 'vietqr'],
        isCustom: false
      }
    ];

    defaultPrompts.forEach(p => {
      this.setDocumentSync('prompt_templates', p.templateId, p);
    });
  }

  public async resetToSeedData(): Promise<void> {
    this.seed('fashion');
  }

  private getCollectionMap(collectionName: string): Map<string, any> {
    if (!this.store.has(collectionName)) {
      this.store.set(collectionName, new Map());
    }
    return this.store.get(collectionName)!;
  }

  private setDocumentSync(collectionName: string, docId: string, data: any): void {
    const col = this.getCollectionMap(collectionName);
    col.set(docId, this.deepClone(data));
  }

  // Document CRUD Operations
  public async getDocument<T = any>(collectionName: string, docId: string): Promise<T | null> {
    const col = this.getCollectionMap(collectionName);
    const data = col.get(docId);
    return data ? this.deepClone<T>(data) : null;
  }

  public async getDoc<T = any>(collectionName: string, docId: string): Promise<T | null> {
    return this.getDocument<T>(collectionName, docId);
  }

  public async setDocument<T = any>(collectionName: string, docId: string, data: T, merge?: boolean): Promise<void> {
    const col = this.getCollectionMap(collectionName);
    if (merge && col.has(docId)) {
      const existing = col.get(docId);
      col.set(docId, this.deepClone({ ...existing, ...data }));
    } else {
      col.set(docId, this.deepClone(data));
    }
  }

  public async setDoc<T = any>(collectionName: string, docId: string, data: T, merge?: boolean): Promise<void> {
    return this.setDocument<T>(collectionName, docId, data, merge);
  }

  public async updateDoc<T = any>(collectionName: string, docId: string, updates: Partial<T>): Promise<void> {
    const col = this.getCollectionMap(collectionName);
    const existing = col.get(docId);
    if (!existing) {
      throw new FirestoreError('updateDoc', collectionName, `Document '${docId}' does not exist`, docId);
    }
    col.set(docId, this.deepClone({ ...existing, ...updates }));
  }

  public async deleteDoc(collectionName: string, docId: string): Promise<void> {
    const col = this.getCollectionMap(collectionName);
    col.delete(docId);
  }

  public async getAllDocs<T = any>(collectionName: string): Promise<T[]> {
    const col = this.getCollectionMap(collectionName);
    return Array.from(col.values()).map(d => this.deepClone<T>(d));
  }

  // Complex Query Evaluator
  public async queryCollection<T = any>(
    collectionName: string,
    optionsOrFilter?: FirestoreQueryOptions | ((item: T) => boolean)
  ): Promise<T[]> {
    const col = this.getCollectionMap(collectionName);
    let items = Array.from(col.values()).map(d => this.deepClone<T>(d));

    if (typeof optionsOrFilter === 'function') {
      return items.filter(optionsOrFilter);
    }

    if (!optionsOrFilter) {
      return items;
    }

    // 1. Where filters
    if (optionsOrFilter.where && optionsOrFilter.where.length > 0) {
      for (const cond of optionsOrFilter.where) {
        items = items.filter((item: any) => {
          const val = item[cond.field];
          switch (cond.operator) {
            case '==':
              return val === cond.value;
            case '!=':
              return val !== cond.value;
            case '<':
              return val < cond.value;
            case '<=':
              return val <= cond.value;
            case '>':
              return val > cond.value;
            case '>=':
              return val >= cond.value;
            case 'array-contains':
              return Array.isArray(val) && val.includes(cond.value);
            case 'in':
              return Array.isArray(cond.value) && cond.value.includes(val);
            default:
              return true;
          }
        });
      }
    }

    // 2. OrderBy
    if (optionsOrFilter.orderBy) {
      const { field, direction } = optionsOrFilter.orderBy;
      const factor = direction === 'desc' ? -1 : 1;
      items.sort((a: any, b: any) => {
        const valA = a[field];
        const valB = b[field];
        if (valA < valB) return -1 * factor;
        if (valA > valB) return 1 * factor;
        return 0;
      });
    }

    // 3. Offset & Limit
    if (optionsOrFilter.offset && optionsOrFilter.offset > 0) {
      items = items.slice(optionsOrFilter.offset);
    }
    if (optionsOrFilter.limit !== undefined && optionsOrFilter.limit >= 0) {
      items = items.slice(0, optionsOrFilter.limit);
    }

    return items;
  }

  // ACID Transaction Engine
  public async runTransaction<T>(updateFunction: (transaction: ITransactionContext) => Promise<T>): Promise<T> {
    let releaseTx: () => void;
    const currentTx = this.transactionMutex;
    this.transactionMutex = new Promise<void>(resolve => {
      releaseTx = resolve;
    });
    await currentTx;

    try {
      // Transaction buffer staged mutations
      const stagedPuts: Array<{ collection: string; docId: string; data: any }> = [];
      const stagedDeletes: Array<{ collection: string; docId: string }> = [];

      // Local snapshot copy for reads within this transaction
      const snapshotStore = new Map<string, Map<string, any>>();
      for (const [colName, colMap] of this.store.entries()) {
        const newColMap = new Map<string, any>();
        for (const [docId, val] of colMap.entries()) {
          newColMap.set(docId, this.deepClone(val));
        }
        snapshotStore.set(colName, newColMap);
      }

      const txContext: ITransactionContext = {
        get: async <DocType>(collection: string, docId: string): Promise<DocType | null> => {
          const col = snapshotStore.get(collection);
          const data = col?.get(docId);
          return data ? this.deepClone<DocType>(data) : null;
        },
        set: <DocType>(collection: string, docId: string, data: DocType): void => {
          stagedPuts.push({ collection, docId, data: this.deepClone(data) });
          // Update local snapshot
          if (!snapshotStore.has(collection)) snapshotStore.set(collection, new Map());
          snapshotStore.get(collection)!.set(docId, this.deepClone(data));
        },
        update: <DocType>(collection: string, docId: string, updates: Partial<DocType>): void => {
          const col = snapshotStore.get(collection);
          const existing = col?.get(docId);
          if (!existing) {
            throw new TransactionConflictError(`Cannot update missing doc '${docId}' in transaction`, collection, docId);
          }
          const merged = { ...existing, ...updates };
          stagedPuts.push({ collection, docId, data: this.deepClone(merged) });
          col!.set(docId, this.deepClone(merged));
        },
        delete: (collection: string, docId: string): void => {
          stagedDeletes.push({ collection, docId });
          snapshotStore.get(collection)?.delete(docId);
        }
      };

      const result = await updateFunction(txContext);

      // Atomically commit all staged mutations
      for (const put of stagedPuts) {
        this.setDocumentSync(put.collection, put.docId, put.data);
      }
      for (const del of stagedDeletes) {
        this.getCollectionMap(del.collection).delete(del.docId);
      }

      return result;
    } finally {
      releaseTx!();
    }
  }

  // Audit Logging Helper
  public async logAuditEvent(event: Omit<AuditLogEntry, 'logId' | 'timestamp'>): Promise<AuditLogEntry> {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const fullEntry: AuditLogEntry = {
      ...event,
      logId,
      timestamp: new Date().toISOString()
    };
    await this.setDocument('audit_logs', logId, fullEntry);
    return fullEntry;
  }

  public async saveAuditLog(log: any): Promise<void> {
    const logId = log.logId || `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await this.setDocument('audit_logs', logId, {
      ...log,
      logId,
      timestamp: log.timestamp || new Date().toISOString()
    });
  }

  public async getAuditLogs(limitOrTenantId?: number | string, filterOrAction?: string): Promise<any[]> {
    if (typeof limitOrTenantId === 'string') {
      const tenantId = limitOrTenantId;
      const all = await this.getAllDocs('audit_logs');
      let filtered = all.filter((l: any) => l.tenantId === tenantId);
      if (filterOrAction) {
        filtered = filtered.filter((l: any) => l.action === filterOrAction);
      }
      return filtered;
    }

    const limit = typeof limitOrTenantId === 'number' ? limitOrTenantId : 50;
    return this.queryCollection('audit_logs', {
      orderBy: { field: 'timestamp', direction: 'desc' },
      limit
    });
  }

  public async writeAuditLog(tenantId: string, entry: Omit<AuditLogEntry, 'logId' | 'timestamp'>): Promise<AuditLogEntry> {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const fullEntry = {
      ...entry,
      logId,
      timestamp: new Date().toISOString(),
      tenantId
    };
    await this.setDocument('audit_logs', logId, fullEntry);
    return fullEntry;
  }

  // Prompt Templates Helper
  public async getPromptTemplates(tenantId?: string): Promise<any[]> {
    if (tenantId) {
      return this.listPromptTemplates(tenantId);
    }
    return this.getAllDocs('prompt_templates');
  }

  public async savePromptTemplate(tenantId: string, template: PromptTemplate): Promise<PromptTemplate> {
    const docId = `${tenantId}_${template.templateId}`;
    await this.setDocument('prompt_templates', docId, { ...template, tenantId });
    return template;
  }

  public async getPromptTemplate(tenantId: string, templateId: string): Promise<PromptTemplate | null> {
    const docId = `${tenantId}_${templateId}`;
    const tmpl = await this.getDocument('prompt_templates', docId);
    return tmpl || null;
  }

  public async listPromptTemplates(tenantId: string): Promise<PromptTemplate[]> {
    const all = await this.getAllDocs('prompt_templates');
    return all.filter((t: any) => t.tenantId === tenantId).map(({ tenantId: _, ...rest }: any) => rest);
  }
}
