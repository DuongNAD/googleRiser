/**
 * Shared Type Definitions for SME AutoPilot AI Engine
 * Compatible with Gemini 2.0 Flash / Pro & Imagen 3
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ReconciliationStatus = 'MATCHED' | 'UNMATCHED' | 'FLAGGED';
export type Recommendation = 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'REJECT';

export type ProductTheme = 'LUXURY_MINIMALIST' | 'NEON_CYBERPUNK' | 'PASTEL_COZY' | 'TRADITIONAL_TET';
export type CopyTone = 'FRIENDLY' | 'PROFESSIONAL' | 'GEN_Z_TRENDY' | 'FLASH_SALE_URGENT' | 'LUXURY_ELEGANT' | 'friendly' | 'luxury' | 'youthful' | 'urgent_sale';
export type RegionalDialect = 'NORTHERN' | 'CENTRAL' | 'SOUTHERN' | 'AUTO_DETECT';

export interface BankInfo {
  bin: string;
  shortName: string;
  fullName: string;
  brandPrimaryColor: string;
  brandSecondaryColor?: string;
  receiptType: 'MODERN_CARD' | 'GRADIENT_BANNER' | 'MINIMAL_LIST' | 'E_WALLET';
  commonFontFamily: string;
  appNames: string[];
}

export interface ForensicAnomaly {
  layer: number; // 1 to 5
  layerName: string;
  type: string;
  description: string;
  penalty: number;
  severity: RiskLevel;
  boundingBox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized
}

export interface DigitalForensicsLayerResult {
  layer1_clockConsistency: {
    passed: boolean;
    statusBarTime?: string;
    receiptTime?: string;
    isClockParadox: boolean;
    timeGapMinutes?: number;
    details: string;
  };
  layer2_typography: {
    passed: boolean;
    fontFamilyMatch: boolean;
    kerningConsistent: boolean;
    baselineAligned: boolean;
    details: string;
  };
  layer3_compressionEla: {
    passed: boolean;
    quantizationUniform: boolean;
    edgeRingingDetected: boolean;
    tamperedRegionsDetected: boolean;
    details: string;
  };
  layer4_brandUi: {
    passed: boolean;
    bankIdentified: string;
    logoAuthentic: boolean;
    colorPaletteMatch: boolean;
    uiLayoutValid: boolean;
    details: string;
  };
  layer5_vietQr: {
    passed: boolean;
    qrPresent: boolean;
    crcValid: boolean;
    calculatedCrc?: string;
    embeddedCrc?: string;
    dataCrossCheckMatch: boolean;
    details: string;
  };
}

export interface VietQRValidationResult {
  isValid: boolean;
  isValidCrc: boolean;
  calculatedCrc: string;
  embeddedCrc: string;
  guid?: string; // e.g. A000000727
  bankBin?: string;
  accountNumber?: string;
  serviceCode?: string; // QRIBFTTA / QRIBFTTC
  currencyCode?: string; // 704 = VND
  amount?: number;
  countryCode?: string; // VN
  transferContent?: string;
  rawPayload: string;
}

export interface ExtractedReceiptData {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  currency: string;
  transactionId: string;
  transactionTime: string;
  transferContent: string;
  qrPayload?: string;
  recipientBankBin?: string;
  recipientAccount?: string;
}

export interface ForensicSignals {
  timestampMatch: boolean;
  fontConsistency: boolean;
  compressionArtifacts: boolean;
  logoAuthenticity: boolean;
  qrIntegrity: boolean;
  anomalies: string[];
}

export interface BillForensicsResult {
  isAuthentic: boolean;
  confidenceScore: number; // 0.0 - 1.0
  riskLevel: RiskLevel;
  extractedData: ExtractedReceiptData;
  forensicSignals: ForensicSignals;
  forensicLayers?: DigitalForensicsLayerResult;
  detailedAnomalies?: ForensicAnomaly[];
  vietQrData?: VietQRValidationResult;
  reconciliationStatus: ReconciliationStatus;
  matchedOrderId?: string;
  recommendation: Recommendation;
  rawOcrText?: string;
  analyzedAt?: string;
  bankMetadata?: BankInfo;
}

export interface VisualFeatureExtractionResult {
  category: string;
  subCategory?: string;
  material?: string;
  materials?: string[];
  color?: string;
  primaryColors?: Array<{ name: string; hex: string }>;
  accentColors?: Array<{ name: string; hex: string }>;
  keySellingPoints: string[];
  targetAudience: string;
  suggestedPriceRange?: { min: number; max: number; currency: 'VND' };
  detectedObjects?: string[];
  visualQualityScore?: number; // 0.0 - 1.0
  brandVibe?: string;
}

export interface StudioStagingPrompt {
  theme: ProductTheme;
  themeDisplayName: string;
  prompt: string;
  negativePrompt: string;
  aspectRatio: '1:1' | '9:16' | '16:9';
  lightingStyle: string;
  cameraSettings: string;
  suggestedProps: string[];
}

export interface StudioPromptsData {
  prompt: string;
  negativePrompt: string;
  aspectRatio: '1:1' | '9:16' | '16:9';
  suggestedThemes?: string[];
  selectedTheme?: ProductTheme;
  prompts?: Record<ProductTheme, StudioStagingPrompt>;
  activePrompt?: StudioStagingPrompt;
  lightingStyle?: string;
  cameraSettings?: string;
  suggestedProps?: string[];
}

export interface MultiChannelCopyResult {
  facebook: {
    headline: string;
    body: string;
    callToAction: string;
    hashtags: string[];
    hookAndProblem?: string;
    valueProposition?: string[];
    socialProof?: string;
    pricingAndPromo?: string;
    fullPost?: string;
  };
  tiktokShop: {
    videoHook: string; // 3-second hook
    videoScript: string;
    soundRecommendation: string;
    hashtags: string[];
    storyboard?: {
      scene1_hook: string;
      scene2_showcase: string;
      scene3_cta: string;
    };
    salesTagBadges?: string[];
    caption?: string;
  };
  zalo: {
    greeting: string;
    promotionText: string;
    directOrderLink: string;
    customerTierGreeting?: string;
    exclusiveVoucher?: string;
    featureHighlights?: string[];
    closingSignature?: string;
    fullMessage?: string;
  };
  shopee: {
    seoTitle: string;
    bulletPoints: string[];
    searchKeywords: string[];
    detailedDescription?: string;
    usageAndCareGuide?: string;
  };
}

export interface ProductMarketingPack {
  productTitle: string;
  extractedAttributes: VisualFeatureExtractionResult;
  studioPrompts: StudioPromptsData;
  channelCopies: MultiChannelCopyResult;
  tonePreset?: 'friendly' | 'luxury' | 'youthful' | 'urgent_sale';
  generatedAt?: string;
  metadata?: {
    generatedAt: string;
    modelUsed: string;
    isMock: boolean;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolResult {
  toolName: string;
  callId?: string;
  success: boolean;
  result: Record<string, any>;
  error?: string;
}

export interface VoiceToolCall {
  name: string;
  args: Record<string, any>;
  callId?: string;
}

export interface VoiceToolResult {
  toolName: string;
  callId?: string;
  result: Record<string, any>;
  error?: string;
}

export interface VoiceAssistantTurn {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  audioData?: string; // base64 encoded audio
  toolCalls?: VoiceToolCall[];
  toolResults?: VoiceToolResult[];
  intent?: 'INVENTORY_QUERY' | 'SHIPPING_CALCULATION' | 'ORDER_CREATION' | 'ORDER_TRACKING' | 'VOUCHER_APPLICATION' | 'GENERAL_FAQ';
  timestamp?: string;
}

export interface VoiceAssistantSessionState {
  sessionId: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: {
    street?: string;
    ward?: string;
    district?: string;
    province?: string;
  };
  detectedDialect: RegionalDialect;
  cart: Array<{
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    variation?: Record<string, string>;
  }>;
  appliedVoucher?: {
    code: string;
    discountAmount: number;
  };
  history: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolCalls?: any[];
    timestamp: string;
  }>;
}

export interface VoiceAssistantResponse {
  sessionId: string;
  responseText: string;
  detectedDialect: RegionalDialect;
  toolCallsExecuted: Array<{
    toolName: string;
    args: Record<string, any>;
    result: any;
  }>;
  sessionState: VoiceAssistantSessionState;
  suggestedQuickReplies?: string[];
}

export interface VoiceAssistantSession {
  sessionId: string;
  merchantId: string;
  history: VoiceAssistantTurn[];
  activeDraftOrder?: any;
  currentLanguage: 'vi-VN';
  dialectPreset?: 'northern' | 'central' | 'southern';
  state?: VoiceAssistantSessionState;
}
