/**
 * SME AutoPilot — Milestone 1: Adversarial Stress Test Suite
 * backend/tests/ai/adversarial_studio_voice_tools.test.ts
 *
 * EMPIRICAL ADVERSARIAL CHALLENGER VERIFICATION FOR:
 * 1. ProductStudio: Missing image metadata, non-standard image formats, 4 preset themes, diverse category inputs, unicode & long text resilience.
 * 2. VoiceAssistant: Regional dialect adaptation (Bắc, Trung, Nam), dialect heuristics vs false-positive protection, multi-turn cart session management, mid-dialogue topic switching.
 * 3. Function Calling Tools:
 *    - query_inventory: Non-existent SKUs, variation queries, zero-stock items, case insensitivity.
 *    - calculate_shipping_fee: Boundary weights (0g, 100g, 500g, 501g, 20kg), remote/island provinces, shipping tiers.
 *    - create_draft_order: Invalid phone numbers, empty cart, address formatting, VietQR EMVCo generation.
 *    - track_order_status: Invalid order IDs, formatted phone lookup, non-existent phones.
 *    - apply_discount_voucher: Expired/invalid codes, exact threshold boundaries, percent cap enforcement, case insensitivity.
 */

import { ProductStudioService } from '../../src/ai/productStudio';
import { VoiceAssistantService } from '../../src/ai/voiceAssistant';
import {
  executeToolCall,
  queryInventory,
  calculateShippingFee,
  createDraftOrder,
  trackOrderStatus,
  applyDiscountVoucher,
  inventoryDB,
  ordersDB
} from '../../src/ai/tools';
import { parseVietQRPayload } from '../../src/ai/billForensics';

export interface AdversarialTestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

export async function runAdversarialTests(): Promise<AdversarialTestResult[]> {
  const results: AdversarialTestResult[] = [];

  async function test(suite: string, name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      results.push({ suite, name, passed: true });
    } catch (err: any) {
      results.push({ suite, name, passed: false, error: err.message || String(err) });
    }
  }

  function assert(condition: any, msg?: string) {
    if (!condition) throw new Error(msg || 'Assertion failed');
  }

  function assertEqual(actual: any, expected: any, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  const studioService = new ProductStudioService();
  const voiceService = new VoiceAssistantService();

  // ==========================================================================
  // SECTION 1: PRODUCT STUDIO ADVERSARIAL SUITE
  // ==========================================================================

  // 1.1 Missing image metadata / imageBase64 without hints
  await test('ProductStudio [Adversarial]', 'Handles raw imageBuffer without merchantHints gracefully', async () => {
    const fakeJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const pack = await studioService.generateProductPack({
      imageBuffer: fakeJpgBuffer
    });

    assert(pack.productTitle.length > 0, 'Should generate title even without hints');
    assert(pack.extractedAttributes.category.length > 0, 'Should extract default categories');
    assert(pack.channelCopies.facebook.headline.length > 0, 'Should generate Facebook copy');
    assert(pack.studioPrompts.selectedTheme === 'TRADITIONAL_TET', 'Should default to TRADITIONAL_TET');
  });

  // 1.2 Non-standard image formats (WebP, AVIF, PNG data URIs)
  await test('ProductStudio [Adversarial]', 'Handles non-standard data URI formats (webp, avif, png)', async () => {
    const webpBase64 = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    const packWebp = await studioService.generateProductPack({
      imageBase64: webpBase64,
      merchantHints: { title: 'Mũ Cói Vintage Đi Biển' }
    });
    assertEqual(packWebp.productTitle, 'Mũ Cói Vintage Đi Biển');
    assert(packWebp.channelCopies.shopee.seoTitle.includes('Mũ Cói'));

    const avifBase64 = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZg==';
    const packAvif = await studioService.generateProductPack({
      imageBase64: avifBase64,
      merchantHints: { title: 'Túi Xách Da Bò Thủ Công' }
    });
    assertEqual(packAvif.productTitle, 'Túi Xách Da Bò Thủ Công');
  });

  // 1.3 Custom theme generation across all 4 themes
  await test('ProductStudio [Adversarial]', 'Verifies distinct stylistic prompts and camera settings for all 4 themes', async () => {
    const features = {
      category: 'Thực Phẩm & Đồ Uống',
      subCategory: 'Cà Phê Rang Mộc',
      material: '100% Robusta Đắk Lắk',
      materials: ['Hạt Robusta nguyên chất', 'Túi giấy kraft tráng bạc'],
      color: 'Nâu Cà Phê & Đen Huyền',
      primaryColors: [{ name: 'Nâu Espresso', hex: '#3D2314' }],
      keySellingPoints: ['Rang mộc thủ công không tẩm ướp', 'Vị đậm đà chuẩn gu Việt'],
      targetAudience: 'Người sành cà phê',
      suggestedPriceRange: { min: 95000, max: 180000, currency: 'VND' as const },
      detectedObjects: ['Gói cà phê', 'Tách cà phê'],
      visualQualityScore: 0.95,
      brandVibe: 'Đậm chất Việt Nam'
    };

    const prompts = studioService.generateStudioPrompts(features, 'Highland Heritage');

    // LUXURY_MINIMALIST
    assert(prompts.LUXURY_MINIMALIST.prompt.includes('Italian Carrara marble'));
    assertEqual(prompts.LUXURY_MINIMALIST.aspectRatio, '1:1');
    assert(prompts.LUXURY_MINIMALIST.cameraSettings.includes('80mm f/2.8'));

    // NEON_CYBERPUNK
    assert(prompts.NEON_CYBERPUNK.prompt.includes('obsidian glass'));
    assertEqual(prompts.NEON_CYBERPUNK.aspectRatio, '9:16');
    assert(prompts.NEON_CYBERPUNK.cameraSettings.includes('50mm f/1.2'));

    // PASTEL_COZY
    assert(prompts.PASTEL_COZY.prompt.includes('Scandinavian oak'));
    assertEqual(prompts.PASTEL_COZY.aspectRatio, '1:1');
    assert(prompts.PASTEL_COZY.cameraSettings.includes('85mm f/1.4'));

    // TRADITIONAL_TET
    assert(prompts.TRADITIONAL_TET.prompt.includes('khay sơn mài') || prompts.TRADITIONAL_TET.prompt.includes('lacquer tray'));
    assertEqual(prompts.TRADITIONAL_TET.aspectRatio, '1:1');
    assert(prompts.TRADITIONAL_TET.cameraSettings.includes('85mm f/2.0'));
  });

  // 1.4 Diverse product input categories & Vietnamese Unicode tones
  await test('ProductStudio [Adversarial]', 'Generates marketing packs for diverse Vietnamese e-commerce product categories', async () => {
    // Category: F&B
    const cafePack = await studioService.generateProductPack({
      merchantHints: {
        title: 'Cà Phê Robusta Mộc Đắk Lắk Hảo Hạng',
        brandName: 'NongTraiViet',
        targetPrice: 135000,
        preferredTone: 'FRIENDLY'
      }
    });
    assertEqual(cafePack.tonePreset, 'friendly');
    assert(cafePack.channelCopies.facebook.body.includes('135.000đ'));

    // Category: Cosmetics with Gen Z tone
    const serumPack = await studioService.generateProductPack({
      merchantHints: {
        title: 'Serum Rau Má Tràm Trà Trị Mụn Dịu Da',
        preferredTone: 'GEN_Z_TRENDY',
        targetPrice: 249000
      }
    });
    assertEqual(serumPack.tonePreset, 'youthful');
    assert((serumPack.channelCopies.tiktokShop.salesTagBadges || []).length >= 2);

    // Category: Heavy Unicode text with special Vietnamese accents
    const complexUnicodeTitle = 'Đặc Sản Thịt Trâu Gác Bếp Tây Bắc Chuẩn Vị Mắc Khén Hạt Dổi 1Kg';
    const unicodePack = await studioService.generateProductPack({
      merchantHints: {
        title: complexUnicodeTitle,
        preferredTone: 'FLASH_SALE_URGENT'
      }
    });
    assertEqual(unicodePack.tonePreset, 'urgent_sale');
    assertEqual(unicodePack.productTitle, complexUnicodeTitle);
  });

  // ==========================================================================
  // SECTION 2: VOICE ASSISTANT ADVERSARIAL SUITE
  // ==========================================================================

  // 2.1 Regional dialect adaptation (Bắc, Trung, Nam) with complex slang
  await test('VoiceAssistant [Adversarial]', 'Differentiates Central Vietnamese dialect with slang (răng, rứa, mô, tê, hè)', async () => {
    const res = await voiceService.processVoiceTurn({
      sessionId: 'sess-adv-central-1',
      userText: 'Mẫu áo dài ni mần răng rứa em, bớt hè cho chị lấy cái mô?'
    });

    assertEqual(res.detectedDialect, 'CENTRAL');
    assert(res.responseText.includes('rứa') || res.responseText.includes('hè'));
  });

  await test('VoiceAssistant [Adversarial]', 'Differentiates Southern Vietnamese dialect with slang (hông, nè, nghen, zậy, hén)', async () => {
    const res = await voiceService.processVoiceTurn({
      sessionId: 'sess-adv-southern-1',
      userText: 'Áo dài này giá nhiêu zậy shop, có tặng kèm nơ hông nè, giao gấp nghen?'
    });

    assertEqual(res.detectedDialect, 'SOUTHERN');
    assert(res.responseText.includes('nè') || res.responseText.includes('nghen') || res.responseText.includes('dạ'));
  });

  await test('VoiceAssistant [Adversarial]', 'Avoids false-positive Southern detection when user uses standard "bao nhiêu" or "không"', async () => {
    // "bao nhiêu" contains "nhiêu" but is Northern/Standard
    const resBaoNhieu = await voiceService.processVoiceTurn({
      sessionId: 'sess-adv-northern-1',
      userText: 'Cho em hỏi mẫu áo dài này giá bao nhiêu tiền vậy ạ, shop không giảm giá sao ạ?'
    });

    assertEqual(resBaoNhieu.detectedDialect, 'NORTHERN');
    assert(resBaoNhieu.responseText.includes('ạ'));
  });

  // 2.2 Multi-turn conversation with stateful cart management
  await test('VoiceAssistant [Adversarial]', 'Handles 4-turn e-commerce journey with cart management and state persistence', async () => {
    const sessionId = 'sess-adv-multiturn-journey';

    // Turn 1: Product Inquiry
    const turn1 = await voiceService.processVoiceTurn({
      sessionId,
      userText: 'Shop ơi có mẫu áo dài cách tân màu đỏ size M không?'
    });
    assertEqual(turn1.toolCallsExecuted.length, 1);
    assertEqual(turn1.toolCallsExecuted[0].toolName, 'query_inventory');
    assertEqual(turn1.sessionState.history.length, 2);

    // Turn 2: Inquire Shipping with Cart Item injection
    const turn2 = await voiceService.processVoiceTurn({
      sessionId,
      userText: 'Phí ship về Hà Nội là bao nhiêu ạ?',
      sessionState: {
        cart: [
          {
            sku: 'AD-TET-01-RED-M',
            productName: 'Áo Dài Cách Tân Tơ Tằm Đỏ (Size M)',
            quantity: 1,
            unitPrice: 589000
          }
        ],
        customerName: 'Trần Thu Hương',
        customerPhone: '0988123456',
        shippingAddress: {
          street: '88 Phố Huế',
          ward: 'Ngô Thì Nhậm',
          district: 'Hai Bà Trưng',
          province: 'Hà Nội'
        }
      }
    });
    assertEqual(turn2.toolCallsExecuted.length, 1);
    assertEqual(turn2.toolCallsExecuted[0].toolName, 'calculate_shipping_fee');
    assertEqual(turn2.sessionState.cart.length, 1);
    assertEqual(turn2.sessionState.history.length, 4);

    // Turn 3: Apply Discount Voucher
    const turn3 = await voiceService.processVoiceTurn({
      sessionId,
      userText: 'Shop áp mã TET2026 khuyến mãi giúp mình với'
    });
    assertEqual(turn3.toolCallsExecuted.length, 1);
    assertEqual(turn3.toolCallsExecuted[0].toolName, 'apply_discount_voucher');
    assertEqual(turn3.sessionState.appliedVoucher?.code, 'TET2026');
    assertEqual(turn3.sessionState.appliedVoucher?.discountAmount, 50000);
    assertEqual(turn3.sessionState.history.length, 6);

    // Turn 4: Create Draft Order (Chốt đơn)
    const turn4 = await voiceService.processVoiceTurn({
      sessionId,
      userText: 'Ok shop tạo đơn đặt hàng luôn cho mình nhé!'
    });
    assertEqual(turn4.toolCallsExecuted.length, 1);
    assertEqual(turn4.toolCallsExecuted[0].toolName, 'create_draft_order');
    assert(turn4.responseText.includes('ORD-VN-'));
    assertEqual(turn4.sessionState.cart.length, 0); // Cart is cleared after order creation
    assertEqual(turn4.sessionState.history.length, 8);
  });

  // 2.3 Topic switching mid-dialogue
  await test('VoiceAssistant [Adversarial]', 'Maintains coherence and routes correctly during erratic topic switching', async () => {
    const sessionId = 'sess-adv-erratic-switching';

    // Inquire product -> Switch to order tracking -> Switch to shipping -> Switch to voucher
    const t1 = await voiceService.processVoiceTurn({ sessionId, userText: 'Cho xem giá áo dài' });
    assertEqual(t1.toolCallsExecuted[0].toolName, 'query_inventory');

    const t2 = await voiceService.processVoiceTurn({ sessionId, userText: 'Khoan, tra cứu đơn hàng của tôi SĐT 0912345678' });
    assertEqual(t2.toolCallsExecuted[0].toolName, 'track_order_status');

    const t3 = await voiceService.processVoiceTurn({ sessionId, userText: 'Giao hàng về Đà Nẵng bao lâu tới?' });
    assertEqual(t3.toolCallsExecuted[0].toolName, 'calculate_shipping_fee');

    const t4 = await voiceService.processVoiceTurn({ sessionId, userText: 'Shop có voucher khuyến mãi gì không?' });
    assertEqual(t4.toolCallsExecuted[0].toolName, 'apply_discount_voucher');

    assertEqual(t4.sessionState.history.length, 8);
  });

  // ==========================================================================
  // SECTION 3: FUNCTION CALLING TOOLS ADVERSARIAL SUITE
  // ==========================================================================

  // 3.1 query_inventory
  await test('Tools [Adversarial]', 'query_inventory handles non-existent SKUs, variation queries, and zero-stock items', async () => {
    // Non-existent SKU
    const notFound = await executeToolCall('query_inventory', { sku: 'NON_EXISTENT_SKU_9999' });
    assertEqual(notFound.found, false);
    assert(notFound.suggestedProducts.length >= 3, 'Should return product suggestions');

    // Case-insensitive query
    const lowerSku = await executeToolCall('query_inventory', { sku: 'ad-tet-01' });
    assertEqual(lowerSku.found, true);
    assertEqual(lowerSku.sku, 'AD-TET-01');

    // Name substring query
    const subName = await executeToolCall('query_inventory', { productName: 'robusta' });
    assertEqual(subName.found, true);
    assertEqual(subName.sku, 'CAFE-ROBUSTA-03');

    // Stock status check: add a temporary zero-stock item into inventoryDB
    inventoryDB.push({
      sku: 'TEST-ZERO-STOCK',
      name: 'Váy Hoa Nhí Hết Hàng',
      category: 'Thời Trang Nữ',
      stock: 0,
      price: 299000,
      originalPrice: 399000,
      variations: []
    });

    const zeroStockRes = await executeToolCall('query_inventory', { sku: 'TEST-ZERO-STOCK' });
    assertEqual(zeroStockRes.found, true);
    assertEqual(zeroStockRes.status, 'OUT_OF_STOCK');
    assertEqual(zeroStockRes.totalStock, 0);

    // Low-stock item check
    inventoryDB.push({
      sku: 'TEST-LOW-STOCK',
      name: 'Áo Len Sắp Hết',
      category: 'Thời Trang Nữ',
      stock: 5,
      price: 350000,
      originalPrice: 450000,
      variations: []
    });

    const lowStockRes = await executeToolCall('query_inventory', { sku: 'TEST-LOW-STOCK' });
    assertEqual(lowStockRes.found, true);
    assertEqual(lowStockRes.status, 'LOW_STOCK');
  });

  // 3.2 calculate_shipping_fee
  await test('Tools [Adversarial]', 'calculate_shipping_fee handles boundary weights (0g, 100g, 500g, 501g, 20kg), remote/island provinces, and tiers', async () => {
    // 0g (weight 0) in Hanoi: base 15,000 VND
    const feeZero = await executeToolCall('calculate_shipping_fee', { province: 'Hà Nội', weightGram: 0 });
    assertEqual(feeZero.shippingFee, 15000);

    // 100g in Hanoi: base 15,000 VND
    const fee100g = await executeToolCall('calculate_shipping_fee', { province: 'Hà Nội', weightGram: 100 });
    assertEqual(fee100g.shippingFee, 15000);

    // Exact 500g boundary in Hanoi: base 15,000 VND
    const fee500g = await executeToolCall('calculate_shipping_fee', { province: 'Hà Nội', weightGram: 500 });
    assertEqual(fee500g.shippingFee, 15000);

    // 501g in Hanoi: 15,000 + 1 block (5,000) = 20,000 VND
    const fee501g = await executeToolCall('calculate_shipping_fee', { province: 'Hà Nội', weightGram: 501 });
    assertEqual(fee501g.shippingFee, 20000);

    // 20kg (20,000g) in Hanoi: 15,000 + ceil((20000-500)/500)*5000 = 15,000 + 39*5,000 = 210,000 VND
    const fee20kgHanoi = await executeToolCall('calculate_shipping_fee', { province: 'Hà Nội', weightGram: 20000 });
    assertEqual(fee20kgHanoi.shippingFee, 210000);

    // Remote island province (Phú Quốc / Kiên Giang, Côn Đảo)
    const kienGiang = await executeToolCall('calculate_shipping_fee', { province: 'Kiên Giang' });
    assertEqual(kienGiang.shippingFee, 35000);

    const dienBien = await executeToolCall('calculate_shipping_fee', { province: 'Điện Biên' });
    assertEqual(dienBien.shippingFee, 35000);

    // Shipping tiers in Hanoi
    const sameDayHN = await executeToolCall('calculate_shipping_fee', { province: 'Hà Nội', shippingTier: 'same_day' });
    assertEqual(sameDayHN.shippingFee, 35000);
    assertEqual(sameDayHN.estimatedDeliveryTime, '2-4 giờ');

    const expressHN = await executeToolCall('calculate_shipping_fee', { province: 'Hà Nội', shippingTier: 'express' });
    assertEqual(expressHN.shippingFee, 25000);

    // Shipping tiers in Major City (Đà Nẵng)
    const expressDN = await executeToolCall('calculate_shipping_fee', { province: 'Đà Nẵng', shippingTier: 'express' });
    assertEqual(expressDN.shippingFee, 45000);
  });

  // 3.3 create_draft_order
  await test('Tools [Adversarial]', 'create_draft_order validates invalid phone numbers, empty carts, and VietQR transfer payloads', async () => {
    // Invalid phone formats
    const invalidPhones = [
      '12345',              // Too short
      '02438255555',        // Landline
      '0123456789',         // Deprecated 11-digit prefix
      '0412345678',         // Invalid mobile prefix 04
      '090123456a',         // Contains letter
      '09012345678',        // 11 digits
      '09123456'            // 8 digits
    ];

    for (const phone of invalidPhones) {
      const res = await executeToolCall('create_draft_order', {
        customerName: 'Invalid Phone Tester',
        customerPhone: phone,
        shippingAddress: { street: '1 Phố Huế', province: 'Hà Nội' },
        items: [{ productName: 'Áo Dài', quantity: 1, unitPrice: 300000 }]
      });
      assertEqual(res.isPhoneValid, false, `Phone "${phone}" should be flagged as invalid`);
    }

    // Valid Vietnamese mobile prefixes (03, 05, 07, 08, 09, +84)
    const validPhones = [
      '0987654321', // Viettel 09
      '0391234567', // Viettel 03
      '0701234567', // Mobifone 07
      '0831234567', // Vinaphone 08
      '0561234567', // Vietnamobile 05
      '+84912345678' // International format
    ];

    for (const phone of validPhones) {
      const res = await executeToolCall('create_draft_order', {
        customerName: 'Valid Phone Tester',
        customerPhone: phone,
        shippingAddress: { street: '1 Phố Huế', province: 'Hà Nội' },
        items: [{ productName: 'Áo Dài', quantity: 1, unitPrice: 300000 }]
      });
      assertEqual(res.isPhoneValid, true, `Phone "${phone}" should be valid`);
    }

    // High value cart (>= 500k -> 0 VND shipping fee)
    const highValueOrder = await executeToolCall('create_draft_order', {
      customerName: 'VIP Customer',
      customerPhone: '0988888888',
      shippingAddress: { street: '123 Kim Mã', province: 'Hà Nội' },
      items: [{ productName: 'Bộ Áo Dài Cao Cấp', quantity: 1, unitPrice: 550000 }]
    });
    assertEqual(highValueOrder.subtotal, 550000);
    assertEqual(highValueOrder.shippingFee, 0); // Free shipping
    assertEqual(highValueOrder.finalAmount, 550000);

    // Low value cart (< 500k -> 30,000 VND shipping fee)
    const lowValueOrder = await executeToolCall('create_draft_order', {
      customerName: 'Normal Customer',
      customerPhone: '0977777777',
      shippingAddress: { street: '123 Kim Mã', province: 'Hà Nội' },
      items: [{ productName: 'Khăn Lụa', quantity: 1, unitPrice: 200000 }]
    });
    assertEqual(lowValueOrder.subtotal, 200000);
    assertEqual(lowValueOrder.shippingFee, 30000);
    assertEqual(lowValueOrder.finalAmount, 230000);

    // Empty cart items: items = []
    const emptyOrder = await executeToolCall('create_draft_order', {
      customerName: 'Empty Cart Tester',
      customerPhone: '0966666666',
      shippingAddress: { street: '123 Test', province: 'Hà Nội' },
      items: []
    });
    assertEqual(emptyOrder.subtotal, 0);
    assertEqual(emptyOrder.itemCount, 0);
    assertEqual(emptyOrder.shippingFee, 30000);
    assertEqual(emptyOrder.finalAmount, 30000);

    // VietQR transfer payment method: generates valid CRC16-checked EMVCo VietQR string
    const qrOrder = await executeToolCall('create_draft_order', {
      customerName: 'QR Pay Customer',
      customerPhone: '0912345678',
      shippingAddress: { street: '123 Lê Lợi', province: 'Hồ Chí Minh' },
      items: [{ productName: 'Áo Dài', quantity: 1, unitPrice: 600000 }],
      paymentMethod: 'VIETQR_TRANSFER'
    });
    assert(qrOrder.vietQrPayload !== undefined);
    assert(qrOrder.vietQrPayload.startsWith('000201010212'));
    // Verify VietQR CRC16 validity
    const qrCheck = parseVietQRPayload(qrOrder.vietQrPayload);
    assertEqual(qrCheck.isValidCrc, true, 'Generated VietQR payload must pass CRC16 validation');
    assertEqual(qrCheck.amount, 600000);
  });

  // 3.4 track_order_status
  await test('Tools [Adversarial]', 'track_order_status handles invalid order IDs, phone formatting with spaces, and missing orders', async () => {
    // Non-existent order ID
    const invalidIdRes = await executeToolCall('track_order_status', { orderId: 'ORD-NON-EXISTENT-999' });
    assertEqual(invalidIdRes.found, false);
    assert(invalidIdRes.message.includes('Không tìm thấy'));

    // Non-existent phone
    const invalidPhoneRes = await executeToolCall('track_order_status', { customerPhone: '0999999999' });
    assertEqual(invalidPhoneRes.found, false);

    // Existing phone with spaces: "0912 345 678" -> should match stored "0912345678"
    const spacedPhoneRes = await executeToolCall('track_order_status', { customerPhone: '0912 345 678' });
    assertEqual(spacedPhoneRes.found, true);
    assertEqual(spacedPhoneRes.orderId, 'ORD-VN-20260814-001');
    assertEqual(spacedPhoneRes.status, 'SHIPPED');
  });

  // 3.5 apply_discount_voucher
  await test('Tools [Adversarial]', 'apply_discount_voucher enforces minimum spends, percentage caps, case insensitivity, and invalid codes', async () => {
    // Invalid/expired voucher codes
    const invalidCodes = ['EXPIRED2025', 'BLACKFRIDAY', 'DISCOUNT100', '', 'null'];
    for (const code of invalidCodes) {
      const res = await executeToolCall('apply_discount_voucher', { voucherCode: code, orderSubtotal: 500000 });
      assertEqual(res.isValid, false, `Code "${code}" should be invalid`);
      assertEqual(res.discountAmount, 0);
      assertEqual(res.finalTotal, 500000);
    }

    // Case insensitivity: lowercase 'tet2026' vs uppercase 'TET2026'
    const lowerTet = await executeToolCall('apply_discount_voucher', { voucherCode: 'tet2026', orderSubtotal: 300000 });
    assertEqual(lowerTet.isValid, true);
    assertEqual(lowerTet.voucherCode, 'TET2026');

    // TET2026: 20% capped at 50,000 VND (minOrder: 200k)
    // Subtotal 199,999 VND (< 200k -> FAIL)
    const tetBelow = await executeToolCall('apply_discount_voucher', { voucherCode: 'TET2026', orderSubtotal: 199999 });
    assertEqual(tetBelow.isValid, false);

    // Subtotal 200,000 VND (exactly minOrder -> 20% = 40,000 VND)
    const tetExact = await executeToolCall('apply_discount_voucher', { voucherCode: 'TET2026', orderSubtotal: 200000 });
    assertEqual(tetExact.isValid, true);
    assertEqual(tetExact.discountAmount, 40000);
    assertEqual(tetExact.finalTotal, 160000);

    // Subtotal 1,000,000 VND (20% = 200,000 VND -> Capped at 50,000 VND)
    const tetCap = await executeToolCall('apply_discount_voucher', { voucherCode: 'TET2026', orderSubtotal: 1000000 });
    assertEqual(tetCap.isValid, true);
    assertEqual(tetCap.discountAmount, 50000);
    assertEqual(tetCap.finalTotal, 950000);

    // FREESHIP: 30,000 VND fixed (minOrder: 300k)
    const freeshipBelow = await executeToolCall('apply_discount_voucher', { voucherCode: 'FREESHIP', orderSubtotal: 299000 });
    assertEqual(freeshipBelow.isValid, false);

    const freeshipPass = await executeToolCall('apply_discount_voucher', { voucherCode: 'FREESHIP', orderSubtotal: 300000 });
    assertEqual(freeshipPass.isValid, true);
    assertEqual(freeshipPass.discountAmount, 30000);
    assertEqual(freeshipPass.finalTotal, 270000);

    // VIP50K: 50,000 VND fixed (minOrder: 400k)
    const vipBelow = await executeToolCall('apply_discount_voucher', { voucherCode: 'VIP50K', orderSubtotal: 399000 });
    assertEqual(vipBelow.isValid, false);

    const vipPass = await executeToolCall('apply_discount_voucher', { voucherCode: 'VIP50K', orderSubtotal: 400000 });
    assertEqual(vipPass.isValid, true);
    assertEqual(vipPass.discountAmount, 50000);
    assertEqual(vipPass.finalTotal, 350000);

    // CHAOBANMOI: 15,000 VND fixed (minOrder: 100k)
    const chaoBelow = await executeToolCall('apply_discount_voucher', { voucherCode: 'CHAOBANMOI', orderSubtotal: 99000 });
    assertEqual(chaoBelow.isValid, false);

    const chaoPass = await executeToolCall('apply_discount_voucher', { voucherCode: 'CHAOBANMOI', orderSubtotal: 100000 });
    assertEqual(chaoPass.isValid, true);
    assertEqual(chaoPass.discountAmount, 15000);
    assertEqual(chaoPass.finalTotal, 85000);

    // AIRISER2026: 100,000 VND fixed (minOrder: 500k)
    const riserBelow = await executeToolCall('apply_discount_voucher', { voucherCode: 'AIRISER2026', orderSubtotal: 499000 });
    assertEqual(riserBelow.isValid, false);

    const riserPass = await executeToolCall('apply_discount_voucher', { voucherCode: 'AIRISER2026', orderSubtotal: 500000 });
    assertEqual(riserPass.isValid, true);
    assertEqual(riserPass.discountAmount, 100000);
    assertEqual(riserPass.finalTotal, 400000);
    // Space padded voucher code: "  TET2026  "
    const spaceVoucher = await executeToolCall('apply_discount_voucher', { voucherCode: '  TET2026  ', orderSubtotal: 300000 });
    assertEqual(spaceVoucher.isValid, true);
    assertEqual(spaceVoucher.voucherCode, 'TET2026');
  });

  // 3.6 Edge cases: create_draft_order with multiple items & address variations
  await test('Tools [Adversarial]', 'create_draft_order handles multi-item orders, custom notes, and missing non-mandatory address fields', async () => {
    const multiItemOrder = await executeToolCall('create_draft_order', {
      customerName: 'Lê Hoàng Long',
      customerPhone: '0903123456',
      shippingAddress: {
        street: 'Số 10 Nguyễn Huệ',
        province: 'Hồ Chí Minh'
      },
      items: [
        { sku: 'AD-TET-01', productName: 'Áo Dài', quantity: 2, unitPrice: 589000 },
        { sku: 'SERUM-RAUMA-02', productName: 'Serum Rau Má', quantity: 3, unitPrice: 245000 },
        { sku: 'CAFE-ROBUSTA-03', productName: 'Cà Phê Robusta', quantity: 1, unitPrice: 135000 }
      ],
      notes: 'Giao giờ hành chính, gọi trước khi giao 15p',
      paymentMethod: 'COD'
    });

    const expectedSubtotal = 2 * 589000 + 3 * 245000 + 1 * 135000; // 1178000 + 735000 + 135000 = 2048000
    assertEqual(multiItemOrder.subtotal, expectedSubtotal);
    assertEqual(multiItemOrder.itemCount, 3);
    assertEqual(multiItemOrder.shippingFee, 0); // Free shipping for >= 500k
    assertEqual(multiItemOrder.finalAmount, expectedSubtotal);
    assertEqual(multiItemOrder.isPhoneValid, true);
  });

  // 3.7 Session lifecycle tests in VoiceAssistant
  await test('VoiceAssistant [Adversarial]', 'Manages session retrieval and clearing lifecycle', async () => {
    const testSessionId = 'sess-lifecycle-test';
    await voiceService.processVoiceTurn({
      sessionId: testSessionId,
      userText: 'Xin chào shop'
    });

    const retrieved = voiceService.getSession(testSessionId);
    assert(retrieved !== undefined, 'Session must exist');
    assertEqual(retrieved?.sessionId, testSessionId);
    assertEqual(retrieved?.history.length, 2);

    voiceService.clearSession(testSessionId);
    const afterClear = voiceService.getSession(testSessionId);
    assertEqual(afterClear, undefined, 'Session must be undefined after clear');
  });

  // 3.8 Audio buffer voice turn processing
  await test('VoiceAssistant [Adversarial]', 'Processes voice turn with raw audioBuffer input without throwing', async () => {
    const fakeAudioBuffer = Buffer.alloc(1024, 0x55);
    const audioRes = await voiceService.processVoiceTurn({
      sessionId: 'sess-audio-turn',
      audioBuffer: fakeAudioBuffer,
      audioMimeType: 'audio/wav'
    });

    assert(audioRes.responseText.length > 0);
    assertEqual(audioRes.sessionState.history.length, 2);
    assertEqual(audioRes.sessionState.history[0].content, '[Giọng nói tiếng Việt]');
  });

  // 3.9 Product Studio input boundary & sanitization tests
  await test('ProductStudio [Adversarial]', 'Sanitizes special characters and handles boundary price values', async () => {
    const xssTitle = '<script>alert("xss")</script> Áo Dài "Tết" & \'Lụa\' 100%';
    const xssPack = await studioService.generateProductPack({
      merchantHints: {
        title: xssTitle,
        brandName: '<b>An Yên</b>',
        targetPrice: 1200000
      }
    });

    assertEqual(xssPack.productTitle, xssTitle);
    assert(xssPack.channelCopies.facebook.body.includes('1.200.000đ'));

    // Verify exception when completely empty input is passed
    let caughtEmpty = false;
    try {
      await studioService.generateProductPack({});
    } catch (e: any) {
      caughtEmpty = true;
      assert(e.message.includes('EMPTY_PRODUCT_INPUT'));
    }
    assert(caughtEmpty, 'Must throw EMPTY_PRODUCT_INPUT');
  });

  return results;
}

// Standalone runner execution if invoked directly
if (require.main === module) {
  runAdversarialTests().then(results => {
    console.log('\n' + '='.repeat(80));
    console.log('  SME AutoPilot — Adversarial Stress Test Suite Results');
    console.log('='.repeat(80));

    let passed = 0;
    for (const r of results) {
      if (r.passed) {
        console.log(`  ✅ [PASS] ${r.suite}: ${r.name}`);
        passed++;
      } else {
        console.log(`  ❌ [FAIL] ${r.suite}: ${r.name}`);
        console.log(`     Error: ${r.error}`);
      }
    }

    console.log('-'.repeat(80));
    console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${results.length - passed}`);
    console.log('='.repeat(80) + '\n');

    if (passed === results.length) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
}
