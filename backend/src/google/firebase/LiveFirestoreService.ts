/**
 * SME AutoPilot — Live Firebase Cloud Firestore Service Adapter
 * backend/src/google/firebase/LiveFirestoreService.ts
 *
 * Implements Cloud Firestore operations using firebase-admin SDK.
 * Handles document CRUD, queries, atomic transactions, and falls back to MockFirestoreService.
 */

import {
  FirestoreQueryOptions,
  ITransactionContext,
  AuditLogEntry,
  PromptTemplate,
  IFirestoreService
} from '../../../../shared';
import { GoogleServiceError } from '../errors';
import { MockFirestoreService } from './MockFirestoreService';

export class LiveFirestoreService implements IFirestoreService {
  private fallbackMock: MockFirestoreService;
  private db: any = null;
  private isConfigured: boolean = false;

  constructor() {
    this.fallbackMock = new MockFirestoreService();
    this.initClient();
  }

  private initClient(): void {
    const hasKey = !!(
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_SERVICE_ACCOUNT
    );
    if (!hasKey) {
      this.isConfigured = false;
      return;
    }

    try {
      const admin = require('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp();
      }
      this.db = admin.firestore();
      this.isConfigured = true;
    } catch (err) {
      console.warn('[LiveFirestoreService] firebase-admin SDK not available, using fallback:', err);
      this.isConfigured = false;
    }
  }

  public isAvailable(): boolean {
    return this.isConfigured && this.db !== null;
  }

  public async getDocument<T = any>(collectionName: string, docId: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return this.fallbackMock.getDocument<T>(collectionName, docId);
    }

    try {
      const doc = await this.db.collection(collectionName).doc(docId).get();
      if (!doc.exists) return null;
      return doc.data() as T;
    } catch (error: any) {
      console.warn(`[LiveFirestoreService] getDocument failed for ${collectionName}/${docId}:`, error?.message);
      return this.fallbackMock.getDocument<T>(collectionName, docId);
    }
  }

  public async getDoc<T = any>(collectionName: string, docId: string): Promise<T | null> {
    return this.getDocument<T>(collectionName, docId);
  }

  public async setDocument<T = any>(collectionName: string, docId: string, data: T, merge?: boolean): Promise<void> {
    if (!this.isAvailable()) {
      return this.fallbackMock.setDocument<T>(collectionName, docId, data, merge);
    }

    try {
      await this.db.collection(collectionName).doc(docId).set(data, { merge: !!merge });
    } catch (error: any) {
      console.warn(`[LiveFirestoreService] setDocument failed for ${collectionName}/${docId}:`, error?.message);
      return this.fallbackMock.setDocument<T>(collectionName, docId, data, merge);
    }
  }

  public async setDoc<T = any>(collectionName: string, docId: string, data: T, merge?: boolean): Promise<void> {
    return this.setDocument<T>(collectionName, docId, data, merge);
  }

  public async updateDoc<T = any>(collectionName: string, docId: string, updates: Partial<T>): Promise<void> {
    if (!this.isAvailable()) {
      return this.fallbackMock.updateDoc<T>(collectionName, docId, updates);
    }

    try {
      await this.db.collection(collectionName).doc(docId).update(updates);
    } catch (error: any) {
      console.warn(`[LiveFirestoreService] updateDoc failed for ${collectionName}/${docId}:`, error?.message);
      return this.fallbackMock.updateDoc<T>(collectionName, docId, updates);
    }
  }

  public async deleteDoc(collectionName: string, docId: string): Promise<void> {
    if (!this.isAvailable()) {
      return this.fallbackMock.deleteDoc(collectionName, docId);
    }

    try {
      await this.db.collection(collectionName).doc(docId).delete();
    } catch (error: any) {
      console.warn(`[LiveFirestoreService] deleteDoc failed for ${collectionName}/${docId}:`, error?.message);
      return this.fallbackMock.deleteDoc(collectionName, docId);
    }
  }

  public async getAllDocs<T = any>(collectionName: string): Promise<T[]> {
    if (!this.isAvailable()) {
      return this.fallbackMock.getAllDocs<T>(collectionName);
    }

    try {
      const snapshot = await this.db.collection(collectionName).get();
      return snapshot.docs.map((doc: any) => doc.data() as T);
    } catch (error: any) {
      console.warn(`[LiveFirestoreService] getAllDocs failed for ${collectionName}:`, error?.message);
      return this.fallbackMock.getAllDocs<T>(collectionName);
    }
  }

  public async queryCollection<T = any>(
    collectionName: string,
    optionsOrFilter?: FirestoreQueryOptions | ((item: T) => boolean)
  ): Promise<T[]> {
    if (!this.isAvailable() || typeof optionsOrFilter === 'function') {
      return this.fallbackMock.queryCollection<T>(collectionName, optionsOrFilter);
    }

    try {
      let query = this.db.collection(collectionName);

      if (optionsOrFilter?.where) {
        for (const cond of optionsOrFilter.where) {
          query = query.where(cond.field, cond.operator as any, cond.value);
        }
      }

      if (optionsOrFilter?.orderBy) {
        query = query.orderBy(optionsOrFilter.orderBy.field, optionsOrFilter.orderBy.direction);
      }

      if (optionsOrFilter?.limit) {
        query = query.limit(optionsOrFilter.limit);
      }

      if (optionsOrFilter?.offset) {
        query = query.offset(optionsOrFilter.offset);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc: any) => doc.data() as T);
    } catch (error: any) {
      console.warn(`[LiveFirestoreService] queryCollection failed for ${collectionName}:`, error?.message);
      return this.fallbackMock.queryCollection<T>(collectionName, optionsOrFilter);
    }
  }

  public async runTransaction<T>(updateFunction: (transaction: ITransactionContext) => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return this.fallbackMock.runTransaction<T>(updateFunction);
    }

    try {
      return await this.db.runTransaction(async (liveTx: any) => {
        const txContext: ITransactionContext = {
          get: async <DocType>(collection: string, docId: string): Promise<DocType | null> => {
            const docRef = this.db.collection(collection).doc(docId);
            const doc = await liveTx.get(docRef);
            return doc.exists ? (doc.data() as DocType) : null;
          },
          set: <DocType>(collection: string, docId: string, data: DocType): void => {
            const docRef = this.db.collection(collection).doc(docId);
            liveTx.set(docRef, data);
          },
          update: <DocType>(collection: string, docId: string, updates: Partial<DocType>): void => {
            const docRef = this.db.collection(collection).doc(docId);
            liveTx.update(docRef, updates);
          },
          delete: (collection: string, docId: string): void => {
            const docRef = this.db.collection(collection).doc(docId);
            liveTx.delete(docRef);
          }
        };

        return await updateFunction(txContext);
      });
    } catch (error: any) {
      console.warn('[LiveFirestoreService] runTransaction failed, using fallback:', error?.message);
      return this.fallbackMock.runTransaction<T>(updateFunction);
    }
  }

  public async logAuditEvent(event: Omit<AuditLogEntry, 'logId' | 'timestamp'>): Promise<AuditLogEntry> {
    return this.fallbackMock.logAuditEvent(event);
  }

  public async saveAuditLog(log: any): Promise<void> {
    return this.fallbackMock.saveAuditLog(log);
  }

  public async getAuditLogs(limitOrTenantId?: number | string, filterOrAction?: string): Promise<any[]> {
    return this.fallbackMock.getAuditLogs(limitOrTenantId, filterOrAction);
  }

  public async writeAuditLog(tenantId: string, entry: Omit<AuditLogEntry, 'logId' | 'timestamp'>): Promise<AuditLogEntry> {
    return this.fallbackMock.writeAuditLog(tenantId, entry);
  }

  public async getPromptTemplates(tenantId?: string): Promise<any[]> {
    return this.fallbackMock.getPromptTemplates(tenantId);
  }

  public async savePromptTemplate(tenantId: string, template: PromptTemplate): Promise<PromptTemplate> {
    return this.fallbackMock.savePromptTemplate(tenantId, template);
  }

  public async getPromptTemplate(tenantId: string, templateId: string): Promise<PromptTemplate | null> {
    return this.fallbackMock.getPromptTemplate(tenantId, templateId);
  }

  public async listPromptTemplates(tenantId: string): Promise<PromptTemplate[]> {
    return this.fallbackMock.listPromptTemplates(tenantId);
  }

  public async resetToSeedData(): Promise<void> {
    return this.fallbackMock.resetToSeedData();
  }
}
