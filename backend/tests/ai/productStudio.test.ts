/**
 * Milestone 1 Unit Tests: AI Product Studio & Multi-Channel Copywriting Engine
 * backend/tests/ai/productStudio.test.ts
 */

import { ProductStudioService } from '../../src/ai/productStudio';

export async function runProductStudioTests(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message || String(err) });
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

  // 1. Visual Feature Extraction & Attributes
  await test('ProductStudio: Extracts visual features, materials, and selling points in Vietnamese', async () => {
    const pack = await studioService.generateProductPack({
      merchantHints: {
        title: 'Áo Dài Cách Tân Tơ Tằm',
        brandName: 'An Yên Boutique'
      }
    });

    assertEqual(pack.productTitle, 'Áo Dài Cách Tân Tơ Tằm');
    assert(pack.extractedAttributes.category.length > 0, 'Category should not be empty');
    assert(pack.extractedAttributes.materials && pack.extractedAttributes.materials.length >= 2, 'Should extract materials');
    assert(pack.extractedAttributes.keySellingPoints.length >= 3, 'Should have >= 3 USPs');
    assert(pack.extractedAttributes.targetAudience.includes('Nữ'), 'Target audience should be identified');
  });

  // 2. 4-Theme Imagen 3 Staging Prompts
  await test('ProductStudio: Generates rich Imagen 3 prompts across all 4 themes', async () => {
    const pack = await studioService.generateProductPack({
      merchantHints: {
        preferredTheme: 'TRADITIONAL_TET'
      }
    });

    const prompts = pack.studioPrompts.prompts;
    assert(prompts !== undefined, 'Prompts map must exist');
    if (prompts) {
      // Luxury Minimalist
      assert(prompts.LUXURY_MINIMALIST.prompt.includes('Italian Carrara marble'));
      assertEqual(prompts.LUXURY_MINIMALIST.aspectRatio, '1:1');

      // Neon Cyberpunk
      assert(prompts.NEON_CYBERPUNK.prompt.includes('obsidian glass'));
      assert(prompts.NEON_CYBERPUNK.prompt.includes('cyan'));
      assertEqual(prompts.NEON_CYBERPUNK.aspectRatio, '9:16');

      // Pastel Cozy
      assert(prompts.PASTEL_COZY.prompt.includes('Scandinavian oak'));
      assertEqual(prompts.PASTEL_COZY.aspectRatio, '1:1');

      // Traditional Tet
      assert(prompts.TRADITIONAL_TET.prompt.includes('lacquer tray') || prompts.TRADITIONAL_TET.prompt.includes('khay sơn mài'));
      assert(prompts.TRADITIONAL_TET.prompt.includes('apricot blossoms') || prompts.TRADITIONAL_TET.prompt.includes('hoa mai vàng'));
    }

    assertEqual(pack.studioPrompts.selectedTheme, 'TRADITIONAL_TET');
  });

  // 3. 4-Channel Localized Vietnamese Copywriting
  await test('ProductStudio: Generates 4-channel copy with Facebook, TikTok, Zalo, Shopee specs', async () => {
    const pack = await studioService.generateProductPack({
      merchantHints: {
        title: 'Áo Dài Tơ Tằm',
        brandName: 'An Yên'
      }
    });

    const copies = pack.channelCopies;

    // Facebook
    assert(copies.facebook.headline.length > 10, 'Facebook headline required');
    assert(copies.facebook.body.length > 30, 'Facebook body required');
    assert(copies.facebook.hashtags.length >= 3, 'Facebook hashtags required');

    // TikTok Shop
    assert(copies.tiktokShop.videoHook.length > 15, 'TikTok 3s hook required');
    assert(copies.tiktokShop.videoScript.length > 20, 'TikTok script required');
    assert(copies.tiktokShop.soundRecommendation.includes('Acoustic') || copies.tiktokShop.soundRecommendation.length > 5);

    // Zalo VIP
    assert(copies.zalo.greeting.includes('Shop em chào') || copies.zalo.greeting.length > 5);
    assert(copies.zalo.directOrderLink.includes('http'));
    assert(copies.zalo.promotionText.length > 5);

    // Shopee SEO
    assert(copies.shopee.seoTitle.includes('Áo Dài'));
    assert(copies.shopee.bulletPoints.length >= 3);
    assert(copies.shopee.searchKeywords.length >= 4);
  });

  // 4. Tone Presets
  await test('ProductStudio: Correctly sets tone presets (friendly, luxury, youthful, urgent_sale)', async () => {
    const luxuryPack = await studioService.generateProductPack({
      merchantHints: { title: 'Túi Da', preferredTone: 'LUXURY_ELEGANT' }
    });
    assertEqual(luxuryPack.tonePreset, 'luxury');

    const youthfulPack = await studioService.generateProductPack({
      merchantHints: { title: 'Áo Thun', preferredTone: 'GEN_Z_TRENDY' }
    });
    assertEqual(youthfulPack.tonePreset, 'youthful');

    const urgentPack = await studioService.generateProductPack({
      merchantHints: { title: 'Sale 50%', preferredTone: 'FLASH_SALE_URGENT' }
    });
    assertEqual(urgentPack.tonePreset, 'urgent_sale');
  });

  // 5. Boundary & Error Handling
  await test('ProductStudio: Throws EMPTY_PRODUCT_INPUT when no input is provided', async () => {
    let threw = false;
    try {
      await studioService.generateProductPack({});
    } catch (e: any) {
      threw = true;
      assert(e.message.includes('EMPTY_PRODUCT_INPUT'));
    }
    assert(threw, 'Should throw on empty input');
  });

  await test('ProductStudio: Handles long essay input without memory failure', async () => {
    const longDesc = 'Áo dài lụa Việt Nam chất lượng cao '.repeat(500);
    const pack = await studioService.generateProductPack({
      merchantHints: {
        title: 'Áo Dài',
        rawDescription: longDesc
      }
    });
    assert(pack.productTitle.length > 0);
  });

  await test('ProductStudio: Preserves Vietnamese Unicode emojis without mojibake', async () => {
    const emojiTitle = '🌸 Áo Dài Tơ Tằm Hà Đông 💃 Đỏ Ruby ✨ [FREESHIP] 🔥 🇻🇳';
    const pack = await studioService.generateProductPack({
      merchantHints: {
        title: emojiTitle
      }
    });
    assertEqual(pack.productTitle, emojiTitle);
    assert(pack.productTitle.includes('🌸'));
    assert(pack.productTitle.includes('🇻🇳'));
  });

  return results;
}
