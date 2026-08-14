import {
  BillForensicsResult,
  ProductMarketingPack,
  Order,
  InventoryItem,
  CalendarEvent,
  TrackingInfo,
  StoreBranch,
  User,
  PromptTemplate
} from '../shared';

export interface TestCaseResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export interface TestSuiteResult {
  name: string;
  filePath?: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  testResults: TestCaseResult[];
}

export interface TierResult {
  tierName: string;
  suites: TestSuiteResult[];
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
}

// Global registry for suites defined in files
type TestFn = () => void | Promise<void>;
type HookFn = () => void | Promise<void>;

interface RegisteredTestCase {
  name: string;
  fn: TestFn;
}

interface RegisteredSuite {
  name: string;
  tests: RegisteredTestCase[];
  beforeEachHooks: HookFn[];
  afterEachHooks: HookFn[];
  beforeAllHooks: HookFn[];
  afterAllHooks: HookFn[];
}

let activeSuite: RegisteredSuite | null = null;
const registeredSuites: RegisteredSuite[] = [];

// ==========================================
// 1. ASSERTION SUITE
// ==========================================

export class AssertionError extends Error {
  constructor(message: string, public actual?: any, public expected?: any) {
    super(message);
    this.name = 'AssertionError';
  }
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'number' && isNaN(a) && isNaN(b)) return true;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

export function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message || 'Assertion failed: expected condition to be true');
  }
}

export function assertTrue(value: boolean, message?: string): void {
  if (value !== true) {
    throw new AssertionError(message || `Expected true, received ${JSON.stringify(value)}`, value, true);
  }
}

export function assertFalse(value: boolean, message?: string): void {
  if (value !== false) {
    throw new AssertionError(message || `Expected false, received ${JSON.stringify(value)}`, value, false);
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (!deepEqual(actual, expected)) {
    const actualStr = typeof actual === 'object' ? JSON.stringify(actual) : String(actual);
    const expectedStr = typeof expected === 'object' ? JSON.stringify(expected) : String(expected);
    throw new AssertionError(
      message || `Expected equality:\n  Actual:   ${actualStr}\n  Expected: ${expectedStr}`,
      actual,
      expected
    );
  }
}

export function assertNotEqual<T>(actual: T, expected: T, message?: string): void {
  if (deepEqual(actual, expected)) {
    throw new AssertionError(
      message || `Expected values not to be equal:\n  Received: ${JSON.stringify(actual)}`,
      actual,
      expected
    );
  }
}

export function assertContains(
  container: string | any[] | Set<any> | Record<string, any>,
  itemOrSubstring: any,
  message?: string
): void {
  if (typeof container === 'string') {
    if (!container.includes(String(itemOrSubstring))) {
      throw new AssertionError(
        message || `Expected string "${container}" to contain "${itemOrSubstring}"`,
        container,
        itemOrSubstring
      );
    }
    return;
  }

  if (Array.isArray(container)) {
    const found = container.some(item => deepEqual(item, itemOrSubstring));
    if (!found) {
      throw new AssertionError(
        message || `Expected array ${JSON.stringify(container)} to contain ${JSON.stringify(itemOrSubstring)}`,
        container,
        itemOrSubstring
      );
    }
    return;
  }

  if (container instanceof Set) {
    if (!container.has(itemOrSubstring)) {
      throw new AssertionError(
        message || `Expected Set to contain item ${JSON.stringify(itemOrSubstring)}`,
        container,
        itemOrSubstring
      );
    }
    return;
  }

  if (typeof container === 'object' && container !== null) {
    if (!(itemOrSubstring in container)) {
      throw new AssertionError(
        message || `Expected object to contain property key "${itemOrSubstring}"`,
        container,
        itemOrSubstring
      );
    }
    return;
  }

  throw new AssertionError(`Unsupported container type: ${typeof container}`);
}

export function assertRange(value: number, min: number, max: number, message?: string): void {
  if (typeof value !== 'number' || isNaN(value) || value < min || value > max) {
    throw new AssertionError(
      message || `Expected value ${value} to be within range [${min}, ${max}]`,
      value,
      { min, max }
    );
  }
}

export function assertMatch(text: string, pattern: RegExp, message?: string): void {
  if (!pattern.test(text)) {
    throw new AssertionError(
      message || `Expected text "${text}" to match pattern ${pattern.toString()}`,
      text,
      pattern
    );
  }
}

export function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new AssertionError(message || `Expected value to be defined and non-null, but received ${value}`);
  }
}

export async function assertThrows(
  fn: () => any | Promise<any>,
  expectedErrorPattern?: string | RegExp,
  message?: string
): Promise<void> {
  let threw = false;
  let thrownError: any = null;

  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      await result;
    }
  } catch (err) {
    threw = true;
    thrownError = err;
  }

  if (!threw) {
    throw new AssertionError(message || 'Expected function to throw an error, but it completed without error.');
  }

  if (expectedErrorPattern) {
    const errMessage = thrownError?.message || String(thrownError);
    if (typeof expectedErrorPattern === 'string') {
      if (!errMessage.includes(expectedErrorPattern)) {
        throw new AssertionError(
          `Expected thrown error message to contain "${expectedErrorPattern}", got "${errMessage}"`,
          errMessage,
          expectedErrorPattern
        );
      }
    } else if (expectedErrorPattern instanceof RegExp) {
      if (!expectedErrorPattern.test(errMessage)) {
        throw new AssertionError(
          `Expected thrown error message to match ${expectedErrorPattern.toString()}, got "${errMessage}"`,
          errMessage,
          expectedErrorPattern
        );
      }
    }
  }
}

// ==========================================
// 2. TEST REGISTRATION & EXECUTION
// ==========================================

export function describe(suiteName: string, fn: () => void | Promise<void>): void {
  const suite: RegisteredSuite = {
    name: suiteName,
    tests: [],
    beforeEachHooks: [],
    afterEachHooks: [],
    beforeAllHooks: [],
    afterAllHooks: []
  };

  const previousSuite = activeSuite;
  activeSuite = suite;
  registeredSuites.push(suite);

  try {
    fn();
  } finally {
    activeSuite = previousSuite;
  }
}

export function test(testName: string, fn: TestFn): void {
  if (!activeSuite) {
    // Default suite
    describe('Default Suite', () => {
      activeSuite!.tests.push({ name: testName, fn });
    });
  } else {
    activeSuite.tests.push({ name: testName, fn });
  }
}

export const it = test;

export function beforeEach(fn: HookFn): void {
  if (activeSuite) {
    activeSuite.beforeEachHooks.push(fn);
  }
}

export function afterEach(fn: HookFn): void {
  if (activeSuite) {
    activeSuite.afterEachHooks.push(fn);
  }
}

export function beforeAll(fn: HookFn): void {
  if (activeSuite) {
    activeSuite.beforeAllHooks.push(fn);
  }
}

export function afterAll(fn: HookFn): void {
  if (activeSuite) {
    activeSuite.afterAllHooks.push(fn);
  }
}

export function resetRegistry(): void {
  registeredSuites.length = 0;
  activeSuite = null;
}

export async function runSuite(suite: RegisteredSuite): Promise<TestSuiteResult> {
  const suiteStart = Date.now();
  const testResults: TestCaseResult[] = [];
  let passedCount = 0;
  let failedCount = 0;

  // Run beforeAll hooks
  for (const hook of suite.beforeAllHooks) {
    await hook();
  }

  for (const t of suite.tests) {
    const testStart = Date.now();
    let testPassed = true;
    let errorMessage: string | undefined;

    try {
      for (const hook of suite.beforeEachHooks) {
        await hook();
      }

      const res = t.fn();
      if (res && typeof res.then === 'function') {
        await res;
      }

      for (const hook of suite.afterEachHooks) {
        await hook();
      }
    } catch (err: any) {
      testPassed = false;
      errorMessage = err?.stack || err?.message || String(err);
    }

    const testDuration = Date.now() - testStart;
    if (testPassed) {
      passedCount++;
    } else {
      failedCount++;
    }

    testResults.push({
      name: t.name,
      passed: testPassed,
      error: errorMessage,
      durationMs: testDuration
    });
  }

  // Run afterAll hooks
  for (const hook of suite.afterAllHooks) {
    await hook();
  }

  const suiteDuration = Date.now() - suiteStart;
  return {
    name: suite.name,
    total: suite.tests.length,
    passed: passedCount,
    failed: failedCount,
    durationMs: suiteDuration,
    testResults
  };
}

export async function runAllRegisteredSuites(): Promise<TestSuiteResult[]> {
  const results: TestSuiteResult[] = [];
  for (const suite of registeredSuites) {
    const res = await runSuite(suite);
    results.push(res);
  }
  return results;
}

// ==========================================
// 3. MOCK DATA GENERATORS (Realistic Vietnamese SME Data)
// ==========================================

export function generateVietQRPayload(bin: string, account: string, amount: number, memo: string): string {
  // Standard EMVCo / NAPAS VietQR string format representation
  const paddedBin = bin.padStart(6, '0');
  const cleanAccount = account.replace(/\s+/g, '');
  const cleanMemo = memo.replace(/[^a-zA-Z0-9 ]/g, '');

  const subTag00 = '0010A000000727';
  const subSub00 = `0006${paddedBin}`;
  const subSub01 = `01${cleanAccount.length.toString().padStart(2, '0')}${cleanAccount}`;
  const subTag01Val = `${subSub00}${subSub01}`;
  const subTag01 = `01${subTag01Val.length.toString().padStart(2, '0')}${subTag01Val}`;
  const tag38Val = `${subTag00}${subTag01}`;
  const tag38 = `38${tag38Val.length.toString().padStart(2, '0')}${tag38Val}`;

  const tag53 = '5303704';
  const amountStr = String(amount);
  const tag54 = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;
  const tag58 = '5802VN';

  const memoSub08 = `08${cleanMemo.length.toString().padStart(2, '0')}${cleanMemo}`;
  const tag62 = `62${memoSub08.length.toString().padStart(2, '0')}${memoSub08}`;
  const tag63 = '6304ABCD';

  return `000201010212${tag38}${tag53}${tag54}${tag58}${tag62}${tag63}`;
}

export function createMockVietQRReceipt(overrides?: Partial<BillForensicsResult>): BillForensicsResult {
  const defaultResult: BillForensicsResult = {
    isAuthentic: true,
    confidenceScore: 0.98,
    riskLevel: 'LOW',
    extractedData: {
      bankName: 'Vietcombank (Ngân hàng TMCP Ngoại Thương Việt Nam)',
      accountNumber: '1029384756',
      accountHolder: 'NGUYEN VAN AN',
      amount: 450000,
      currency: 'VND',
      transactionId: 'FT24081498124501',
      transactionTime: '2026-08-14 10:25:30',
      transferContent: 'SME9823 Ao Dai Lua Ha Dong Size L',
      qrPayload: generateVietQRPayload('970436', '1029384756', 450000, 'SME9823'),
      recipientBankBin: '970436',
      recipientAccount: '1029384756'
    },
    forensicSignals: {
      timestampMatch: true,
      fontConsistency: true,
      compressionArtifacts: false,
      logoAuthenticity: true,
      qrIntegrity: true,
      anomalies: []
    },
    reconciliationStatus: 'MATCHED',
    matchedOrderId: 'ORD-VN-2026-0814-001',
    recommendation: 'AUTO_APPROVE',
    rawOcrText: 'CHUYEN TIEN THANH CONG\nSo tien: 450,000 VND\nTai khoan nguon: 1029384756 NGUYEN VAN AN\nNgan hang thu huong: Vietcombank\nMa GD: FT24081498124501\nThoi gian: 14/08/2026 10:25:30\nNoi dung: SME9823 Ao Dai Lua Ha Dong Size L',
    analyzedAt: new Date().toISOString()
  };

  return {
    ...defaultResult,
    ...overrides,
    extractedData: { ...defaultResult.extractedData, ...(overrides?.extractedData || {}) },
    forensicSignals: { ...defaultResult.forensicSignals, ...(overrides?.forensicSignals || {}) }
  };
}

export function createMockProductMarketingPack(overrides?: Partial<ProductMarketingPack>): ProductMarketingPack {
  const defaultPack: ProductMarketingPack = {
    productTitle: 'Áo Dài Lụa Tơ Tằm Hà Đông Dáng Xưa Cao Cấp',
    extractedAttributes: {
      category: 'Thời Trang Nữ Truyền Thống',
      material: '100% Lụa Tơ Tằm Hà Đông tự nhiên',
      color: 'Đỏ Ruby / Xanh Cổ Vịt / Vàng Hoàng Yến',
      targetAudience: 'Phụ nữ 22-45 tuổi yêu thích nét đẹp truyền thống và thanh lịch',
      keySellingPoints: [
        'Dệt thủ công từ làng nghề Vạn Phúc, Hà Đông',
        'Chất vải lụa mềm mịn, thoáng mát, không nhăn dính',
        'Form dáng chuẩn tôn eo, cổ 3cm thanh thoát',
        'Họa tiết hoa sen thêu tay tinh xảo'
      ]
    },
    studioPrompts: {
      prompt: 'A premium Vietnamese traditional silk Ao Dai dress in elegant ruby red, meticulously draped on a minimalist mannequin, staged in an authentic ancient Hanoi Old Quarter courtyard with warm natural morning sunlight, lotus ceramic vase background, cinematic lighting, 8k resolution, photorealistic studio photography.',
      negativePrompt: 'blurry, low quality, oversaturated, deformed proportions, modern plastic elements, watermark, noise.',
      aspectRatio: '1:1',
      suggestedThemes: ['Hanoi Heritage', 'Modern Minimalist Studio', 'Spring Lotus Garden']
    },
    channelCopies: {
      facebook: {
        headline: '✨ NÉT ĐẸP DI SẢN: ÁO DÀI LỤA HÀ ĐÔNG THÊU TAY TINH TẾ ✨',
        body: 'Thổi bừng nét duyên dáng người phụ nữ Việt với BST Áo Dài Lụa Tơ Tằm Hà Đông. Từng đường kim thêu sen tỉ mỉ trên nền lụa thượng hạng Vạn Phúc giúp nàng tự tin tỏa sáng trong mọi dịp lễ hội, dạo phố và sự kiện quan trọng.',
        callToAction: '👉 Nhắn tin ngay để nhận ưu đãi 20% + Miễn phí vận chuyển toàn quốc hôm nay!',
        hashtags: ['#AoDaiVietNam', '#LuaHaDong', '#ThoiTrangNu', '#SMEAutoPilot']
      },
      tiktokShop: {
        videoHook: 'Mặc áo dài lụa này lên ai cũng nghĩ tiền triệu nhưng giá chỉ bằng 2 cốc trà sữa? Thật không? 😱',
        videoScript: 'Cùng mình unbox siêu phẩm Áo Dài Lụa Hà Đông thêu sen nha! Chất lụa mát rượi, vuốt êm ru không lo nhăn. Form may chuẩn từng centimet tôn trọn đường cong. Bấm ngay góc trái màn hình để săn deal hời nhé!',
        soundRecommendation: 'Trending Vietnamese chill acoustic - Nắng Có Mang Em Về',
        hashtags: ['#TikTokShopVN', '#ReviewThoiTrang', '#AoDaiDep', '#DealSoc']
      },
      zalo: {
        greeting: 'Dạ em chào Chị yêu ạ! 🌸',
        promotionText: 'Shop vừa về đợt Áo Dài Lụa Hà Đông mẫu mới nhất 2026. Em gửi Chị xem bảng size và màu mới độc quyền chỉ dành riêng cho khách VIP Zalo ạ!',
        directOrderLink: 'https://smeautopilot.vn/order/aodai-hadong-vip'
      },
      shopee: {
        seoTitle: '[Chính Hãng] Áo Dài Lụa Tơ Tằm Hà Đông Thêu Hoa Sen Cao Cấp Form Chuẩn Duyên Dáng',
        bulletPoints: [
          'Chất liệu: 100% Lụa Hà Đông chính gốc Vạn Phúc mềm mát',
          'Thiết kế: Dáng suông nhẹ tôn dáng, khóa kéo giọt nước sau lưng',
          'Đầy đủ size: S (40-47kg), M (48-53kg), L (54-58kg), XL (59-65kg)',
          'Hỗ trợ đổi trả miễn phí trong 7 ngày nếu không vừa size'
        ],
        searchKeywords: ['áo dài lụa', 'áo dài hà đông', 'áo dài thêu sen', 'áo dài nữ truyền thống']
      }
    },
    tonePreset: 'luxury',
    generatedAt: new Date().toISOString()
  };

  return {
    ...defaultPack,
    ...overrides
  };
}

export function createMockOrder(overrides?: Partial<Order>): Order {
  const defaultOrder: Order = {
    orderId: 'ORD-VN-2026-0814-001',
    customerName: 'Trần Thị Mai Phương',
    customerPhone: '0912345678',
    deliveryAddress: 'Số 45 Tràng Tiền, Phường Tràng Tiền, Quận Hoàn Kiếm',
    city: 'Hanoi',
    district: 'Quận Hoàn Kiếm',
    items: [
      {
        sku: 'AD-LUA-HD-RED-L',
        name: 'Áo Dài Lụa Hà Đông Màu Đỏ Size L',
        quantity: 1,
        unitPrice: 450000,
        subtotal: 450000
      }
    ],
    itemsSubtotal: 450000,
    shippingFee: 30000,
    discountAmount: 30000,
    voucherCode: 'FREESHIPVN',
    totalAmount: 450000,
    paymentMethod: 'VIETQR_NAPAS',
    paymentStatus: 'VERIFIED',
    orderStatus: 'CONFIRMED',
    vietqrPayload: generateVietQRPayload('970436', '1029384756', 450000, 'ORD-VN-2026-0814-001'),
    transactionRef: 'FT24081498124501',
    createdAt: '2026-08-14T03:30:00.000Z',
    updatedAt: '2026-08-14T03:35:00.000Z',
    notes: 'Giao giờ hành chính, gọi trước khi giao'
  };

  return {
    ...defaultOrder,
    ...overrides
  };
}

export function createMockInventoryItem(overrides?: Partial<InventoryItem>): InventoryItem {
  const defaultItem: InventoryItem = {
    sku: 'AD-LUA-HD-RED-L',
    name: 'Áo Dài Lụa Hà Đông Màu Đỏ Size L',
    category: 'Thời Trang',
    price: 450000,
    stock: 25,
    unit: 'bộ',
    lowStockThreshold: 5,
    lastUpdated: '2026-08-14T03:00:00.000Z'
  };

  return {
    ...defaultItem,
    ...overrides
  };
}

export function createMockCalendarEvent(overrides?: Partial<CalendarEvent>): CalendarEvent {
  const defaultEvent: CalendarEvent = {
    eventId: 'cal_event_livestream_0814',
    summary: '🔥 Livestream TikTok Shop & Xả Kho Đầu Tháng',
    description: 'Livestream bán hàng trực tiếp trên TikTok Shop và Facebook Live. Giới thiệu BST Áo Dài Lụa và Váy Hoa Mùa Thu.',
    startDateTime: '2026-08-14T19:30:00+07:00',
    endDateTime: '2026-08-14T21:30:00+07:00',
    location: 'Studio SME AutoPilot Hanoi - 45 Tràng Tiền',
    eventType: 'LIVESTREAM_SALES',
    attendees: ['host@smeautopilot.vn', 'sale@smeautopilot.vn'],
    status: 'CONFIRMED',
    htmlLink: 'https://calendar.google.com/event?eid=mock_cal_0814',
    created: '2026-08-14T02:00:00.000Z'
  };

  return {
    ...defaultEvent,
    ...overrides
  };
}

export function createMockTrackingInfo(overrides?: Partial<TrackingInfo>): TrackingInfo {
  const defaultTracking: TrackingInfo = {
    trackingCode: 'VNP-HN-20260814-998',
    orderId: 'ORD-VN-2026-0814-001',
    recipientName: 'Trần Thị Mai Phương',
    recipientPhone: '0912345678',
    recipientEmail: 'maiphuong.tran@gmail.com',
    shippingCarrier: 'VNPost Express (Giao hàng Nhanh Hà Nội)',
    originAddress: 'Kho Tổng SME AutoPilot, 18 Hàng Gai, Hoàn Kiếm, Hà Nội',
    destinationAddress: '45 Tràng Tiền, Hoàn Kiếm, Hà Nội',
    currentStatus: 'IN_TRANSIT',
    estimatedDeliveryTime: '2026-08-14 16:00:00',
    driverNotes: 'Shipper đang trên đường giao, liên hệ người nhận trước 10 phút'
  };

  return {
    ...defaultTracking,
    ...overrides
  };
}

export function createMockStoreBranch(overrides?: Partial<StoreBranch>): StoreBranch {
  const defaultBranch: StoreBranch = {
    branchId: 'BR-HN-01',
    name: 'Chi Nhánh Hoàn Kiếm - Trung Tâm Hà Nội',
    address: '18 Hàng Gai, Phường Hàng Gai, Quận Hoàn Kiếm, Hà Nội',
    district: 'Quận Hoàn Kiếm',
    city: 'Hanoi',
    location: {
      lat: 21.033333,
      lng: 105.850000
    },
    phone: '02438289999',
    isMainWarehouse: true,
    activeStockCount: 1450
  };

  return {
    ...defaultBranch,
    ...overrides
  };
}

export function createMockUser(overrides?: Partial<User>): User {
  const defaultUser: User = {
    uid: 'user_sme_hn_001',
    email: 'merchant.hanoi@smeautopilot.vn',
    displayName: 'Nguyễn Văn Chủ Shop',
    role: 'merchant',
    shopName: 'Tiệm Lụa Hà Đông Cổ Phục',
    tier: 'pro',
    createdAt: '2026-01-15T00:00:00.000Z'
  };

  return {
    ...defaultUser,
    ...overrides
  };
}

export function createMockPromptTemplate(overrides?: Partial<PromptTemplate>): PromptTemplate {
  const defaultPrompt: PromptTemplate = {
    templateId: 'tmpl_product_copy_vn_01',
    title: 'Vietnamese Multi-Channel Copywriting Master',
    category: 'product_copy',
    systemInstruction: 'Bạn là chuyên gia Marketing và Copywriting hàng đầu cho các sàn TMĐT tại Việt Nam (Shopee, TikTok Shop, Facebook, Zalo). Bạn nắm vững văn hóa mua sắm và ngôn ngữ của người tiêu dùng Việt.',
    userPromptTemplate: 'Hãy tạo nội dung bán hàng cho sản phẩm: {{productTitle}}, với các đặc điểm: {{attributes}} theo tông giọng {{tone}}.',
    model: 'gemini-2.0-flash',
    temperature: 0.7,
    topP: 0.95,
    tags: ['vietnamese', 'ecommerce', 'multichannel', 'sme'],
    isCustom: false
  };

  return {
    ...defaultPrompt,
    ...overrides
  };
}

export function createMockSeedDataset(type: 'fashion' | 'fnb' | 'cosmetics'): any {
  if (type === 'fashion') {
    return {
      category: 'fashion',
      shopName: 'Tiệm Lụa & Cổ Phục Hà Nội',
      items: [
        createMockInventoryItem({ sku: 'FAS-AD-01', name: 'Áo Dài Lụa Tơ Tằm Hà Đông', price: 550000, stock: 45 }),
        createMockInventoryItem({ sku: 'FAS-VM-02', name: 'Váy Midi Linen Thêu Tay Mùa Thu', price: 380000, stock: 20 }),
        createMockInventoryItem({ sku: 'FAS-ST-03', name: 'Sơ Mi Tơ Dập Ly Dáng Rộng', price: 290000, stock: 35 })
      ]
    };
  } else if (type === 'fnb') {
    return {
      category: 'fnb',
      shopName: 'Trà Sữa & Đặc Sản Trái Cây Miền Tây',
      items: [
        createMockInventoryItem({ sku: 'FNB-TS-01', name: 'Trà Sữa Oolong Nướng Trân Châu', price: 45000, stock: 120, unit: 'ly' }),
        createMockInventoryItem({ sku: 'FNB-TR-02', name: 'Trà Trái Cây Nhiệt Đới Hạt Sen', price: 50000, stock: 80, unit: 'ly' }),
        createMockInventoryItem({ sku: 'FNB-CF-03', name: 'Cà Phê Muối Xứ Huế Truyền Thống', price: 35000, stock: 95, unit: 'ly' })
      ]
    };
  } else {
    return {
      category: 'cosmetics',
      shopName: 'Mỹ Phẩm Thiên Nhiên Việt Xanh',
      items: [
        createMockInventoryItem({ sku: 'COS-SR-01', name: 'Serum Rau Má Phục Hồi Da Nhạy Cảm', price: 220000, stock: 60, unit: 'chai' }),
        createMockInventoryItem({ sku: 'COS-KR-02', name: 'Kem Chống Nắng Tràm Trà Kiềm Dầu', price: 185000, stock: 75, unit: 'tuýp' }),
        createMockInventoryItem({ sku: 'COS-ST-03', name: 'Son Dưỡng Gấc Dừa Lên Màu Tự Nhiên', price: 95000, stock: 110, unit: 'thỏi' })
      ]
    };
  }
}
