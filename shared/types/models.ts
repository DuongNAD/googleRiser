export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'merchant' | 'operator' | 'demo_judge';
  shopName: string;
  tier: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}

export interface AuditLogEntry {
  logId: string;
  timestamp: string;
  action: 'BILL_AUDITED' | 'ORDER_SYNCED' | 'PROMPT_GENERATED' | 'EMAIL_DISPATCHED' | 'CALENDAR_SCHEDULED' | 'STOCK_ADJUSTED';
  actorId: string;
  details: Record<string, any>;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
}

export interface PromptTemplate {
  templateId: string;
  title: string;
  category: 'product_copy' | 'imagen_staging' | 'voice_assistant' | 'forensics_audit';
  systemInstruction: string;
  userPromptTemplate: string;
  model: 'gemini-2.0-flash' | 'gemini-2.0-pro-exp' | 'imagen-3.0-generate-002';
  temperature: number;
  topP?: number;
  tags: string[];
  isCustom: boolean;
}

export interface ShopProfile {
  shopId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  defaultBankBin: string; // e.g., 970436 for Vietcombank
  defaultBankAccount: string;
  accountHolderName: string;
  address: string;
  city: string;
  businessCategory: 'fashion' | 'fnb' | 'cosmetics' | 'electronics' | 'general';
  isDemoMode: boolean;
}
