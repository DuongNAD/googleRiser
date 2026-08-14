import { RiskLevel, Order, BillForensicsResult, CopyTone } from '@shared';

export type TonePreset = 'friendly' | 'luxury' | 'youthful' | 'urgent_sale';

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  label: string;
  anomalyType?: string;
}

export function validateDropzoneFile(file: { name: string; sizeBytes: number; type: string }): {
  accepted: boolean;
  error?: string;
} {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    return {
      accepted: false,
      error: `Định dạng tệp không hợp lệ (${file.type}). Vui lòng tải lên PNG, JPEG, WEBP hoặc PDF.`
    };
  }

  if (file.sizeBytes > maxSizeBytes) {
    return {
      accepted: false,
      error: `Kích thước tệp vượt quá giới hạn 10MB (${(file.sizeBytes / (1024 * 1024)).toFixed(1)}MB).`
    };
  }

  return { accepted: true };
}

export function computeRiskDialAngle(riskLevel: RiskLevel, confidenceScore: number = 0.95): {
  angleDegrees: number;
  colorHex: string;
  labelVi: string;
} {
  switch (riskLevel) {
    case 'LOW':
      return {
        angleDegrees: Math.round((1 - Math.min(1, Math.max(0, confidenceScore))) * 60),
        colorHex: '#10B981',
        labelVi: 'An Toàn'
      };
    case 'MEDIUM':
      return { angleDegrees: 75, colorHex: '#F59E0B', labelVi: 'Nghi Vấn' };
    case 'HIGH':
      return { angleDegrees: 135, colorHex: '#EF4444', labelVi: 'Rủi Ro Cao' };
    case 'CRITICAL':
      return { angleDegrees: 180, colorHex: '#7F1D1D', labelVi: 'Gian Lận' };
    default:
      return { angleDegrees: 0, colorHex: '#10B981', labelVi: 'Không Xác Định' };
  }
}

export function normalizeBoundingBox(box: BoundingBox): BoundingBox {
  return {
    ymin: Math.max(0, Math.min(1000, box.ymin)),
    xmin: Math.max(0, Math.min(1000, box.xmin)),
    ymax: Math.max(0, Math.min(1000, box.ymax)),
    xmax: Math.max(0, Math.min(1000, box.xmax)),
    label: box.label,
    anomalyType: box.anomalyType
  };
}

export interface PromptPlaygroundConfig {
  model: 'gemini-2.0-flash' | 'gemini-2.0-pro-exp' | 'imagen-3.0-generate-002';
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  systemInstruction: string;
}

export function validatePlaygroundConfig(cfg: PromptPlaygroundConfig): { valid: boolean; error?: string } {
  if (cfg.temperature < 0 || cfg.temperature > 2.0) {
    return { valid: false, error: 'Temperature must be between 0.0 and 2.0' };
  }
  if (cfg.topP < 0 || cfg.topP > 1.0) {
    return { valid: false, error: 'TopP must be between 0.0 and 1.0' };
  }
  if (cfg.maxOutputTokens <= 0 || cfg.maxOutputTokens > 8192) {
    return { valid: false, error: 'Max output tokens must be between 1 and 8192' };
  }
  return { valid: true };
}

export function validateAudioBuffer(base64Data: string, sampleRateHz: number = 16000): {
  valid: boolean;
  sizeBytes: number;
  estimatedDurationSec: number;
} {
  if (!base64Data || typeof base64Data !== 'string') {
    return {
      valid: false,
      sizeBytes: 0,
      estimatedDurationSec: 0
    };
  }

  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (cleanBase64.length === 0) {
    return {
      valid: false,
      sizeBytes: 0,
      estimatedDurationSec: 0
    };
  }

  const paddingCount = (cleanBase64.endsWith('==') ? 2 : cleanBase64.endsWith('=') ? 1 : 0);
  const byteLength = (cleanBase64.length * 3) / 4 - paddingCount;
  const sizeBytes = Math.max(0, byteLength);
  const bytesPerSample = 2;
  const samples = sizeBytes / bytesPerSample;
  const estimatedDurationSec = Math.round((samples / sampleRateHz) * 10) / 10;

  return {
    valid: sizeBytes >= 100,
    sizeBytes,
    estimatedDurationSec
  };
}

export function validateImageUpload(mimeType: string, fileSizeMb: number): { valid: boolean; normalizedMime: string } {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(mimeType)) {
    throw new Error(`UNSUPPORTED_MIME_TYPE: File type "${mimeType}" is not supported. Allowed formats: JPG, PNG, WEBP.`);
  }

  if (fileSizeMb > 25) {
    throw new Error(`FILE_TOO_LARGE: Image size (${fileSizeMb}MB) exceeds 25MB limit.`);
  }

  return { valid: true, normalizedMime: mimeType };
}

export function normalizeAspectRatio(requestedRatio: string): '1:1' | '9:16' | '16:9' {
  if (requestedRatio === '1:1' || requestedRatio === '9:16' || requestedRatio === '16:9') {
    return requestedRatio;
  }

  const parts = requestedRatio.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] !== 0) {
    const decimal = parts[0] / parts[1];
    if (decimal < 0.75) return '9:16';
    if (decimal > 1.33) return '16:9';
    return '1:1';
  }

  return '1:1';
}

export function calculateCopyLengthLimit(platform: 'facebook' | 'tiktokShop' | 'zalo' | 'shopee', userWordLimit?: number): number {
  const platformDefaults: Record<string, number> = {
    facebook: 150,
    tiktokShop: 80,
    zalo: 50,
    shopee: 200
  };

  if (userWordLimit === undefined || userWordLimit <= 0 || isNaN(userWordLimit)) {
    return platformDefaults[platform] || 100;
  }

  return userWordLimit;
}

export function calculateOrderTotal(subtotal: number, shippingFee: number, discount: number): number {
  const rawTotal = subtotal + shippingFee - discount;
  return Math.max(0, rawTotal);
}

export type OrderStatus = Order['orderStatus'];

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  'DRAFT': ['CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['PACKING', 'CANCELLED'],
  'PACKING': ['SHIPPED', 'CANCELLED'],
  'SHIPPED': ['DELIVERED', 'CANCELLED'],
  'DELIVERED': [],
  'CANCELLED': []
};

export function transitionOrderStatus(current: OrderStatus, next: OrderStatus): OrderStatus {
  const allowed = VALID_ORDER_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`INVALID_STATE_TRANSITION: Cannot transition order from status "${current}" to "${next}".`);
  }
  return next;
}

export function searchOrders(orders: Order[], query: string): Order[] {
  if (!query || query.trim() === '') return orders;

  const cleanQuery = query.trim().toLowerCase();
  return orders.filter((o: Order) => {
    return (
      o.orderId.toLowerCase().includes(cleanQuery) ||
      o.customerName.toLowerCase().includes(cleanQuery) ||
      o.customerPhone.includes(cleanQuery) ||
      (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(cleanQuery))
    );
  });
}

export function filterOrders(
  orders: Order[],
  filters: { orderStatus?: string; paymentStatus?: string; search?: string }
): Order[] {
  let list = orders;
  if (filters.search) {
    list = searchOrders(list, filters.search);
  }
  return list.filter((order: Order) => {
    if (filters.orderStatus && filters.orderStatus !== 'ALL' && order.orderStatus !== filters.orderStatus) {
      return false;
    }
    if (filters.paymentStatus && filters.paymentStatus !== 'ALL' && order.paymentStatus !== filters.paymentStatus) {
      return false;
    }
    return true;
  });
}

export function paginateOrders(
  orders: Order[],
  page: number,
  pageSize: number
): { data: Order[]; page: number; pageSize: number; totalItems: number; totalPages: number } {
  const totalItems = orders.length;
  const safePageSize = Math.max(1, Math.min(100, pageSize));
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.max(1, Math.min(totalPages, page));

  const startIndex = (safePage - 1) * safePageSize;
  const data = orders.slice(startIndex, startIndex + safePageSize);

  return {
    data,
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages
  };
}

export function resolveThemePreference(storedTheme: string | null, systemPrefersDark: boolean): 'dark' | 'light' {
  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme;
  }
  return systemPrefersDark ? 'dark' : 'light';
}

export function resolveImageSource(srcUrl: string, hasError: boolean): { src: string; isFallback: boolean } {
  const placeholderSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23eee"/></svg>';
  if (hasError || !srcUrl || srcUrl.trim() === '') {
    return { src: placeholderSvg, isFallback: true };
  }
  return { src: srcUrl, isFallback: false };
}

export function calculateResponsiveLayout(viewportWidth: number): {
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4k';
  containerMaxWidthPx: number;
  sidebarCollapsed: boolean;
  gridColumns: number;
  touchTargetMinPx: number;
} {
  if (viewportWidth <= 480) {
    return {
      breakpoint: 'xs',
      containerMaxWidthPx: viewportWidth,
      sidebarCollapsed: true,
      gridColumns: 1,
      touchTargetMinPx: 44
    };
  }

  if (viewportWidth < 768) {
    return {
      breakpoint: 'sm',
      containerMaxWidthPx: viewportWidth,
      sidebarCollapsed: true,
      gridColumns: 1,
      touchTargetMinPx: 44
    };
  }

  if (viewportWidth < 1024) {
    return {
      breakpoint: 'md',
      containerMaxWidthPx: 768,
      sidebarCollapsed: false,
      gridColumns: 2,
      touchTargetMinPx: 36
    };
  }

  if (viewportWidth < 1280) {
    return {
      breakpoint: 'lg',
      containerMaxWidthPx: 1024,
      sidebarCollapsed: false,
      gridColumns: 3,
      touchTargetMinPx: 32
    };
  }

  if (viewportWidth >= 2560) {
    return {
      breakpoint: '4k',
      containerMaxWidthPx: 1536,
      sidebarCollapsed: false,
      gridColumns: 4,
      touchTargetMinPx: 32
    };
  }

  return {
    breakpoint: '2xl',
    containerMaxWidthPx: 1280,
    sidebarCollapsed: false,
    gridColumns: 4,
    touchTargetMinPx: 32
  };
}
