/**
 * SME AutoPilot — Product Studio & Multi-Channel Copywriting Engine
 * backend/src/ai/productStudio.ts
 *
 * Implements Visual Feature Extraction, 4-Theme Imagen 3 Studio Staging Prompt Generator,
 * 4-Channel Localized Vietnamese Copywriting (FB, TikTok Shop, Zalo, Shopee), and tone adaptation.
 */

import {
  ProductMarketingPack,
  ProductTheme,
  CopyTone,
  VisualFeatureExtractionResult,
  StudioStagingPrompt,
  StudioPromptsData,
  MultiChannelCopyResult
} from '../../../shared/types/ai';
import { GeminiClientService, getGeminiClient } from './geminiClient';

export interface GenerateProductPackInput {
  imageBuffer?: Buffer;
  imageBase64?: string;
  imageUrl?: string;
  merchantHints?: {
    title?: string;
    rawDescription?: string;
    targetPrice?: number;
    brandName?: string;
    preferredTheme?: ProductTheme;
    preferredTone?: CopyTone;
  };
}

export class ProductStudioService {
  private geminiClient: GeminiClientService;

  constructor(geminiClient?: GeminiClientService) {
    this.geminiClient = geminiClient || getGeminiClient();
  }

  /**
   * Main entry point: generates complete marketing pack from image and/or text input
   */
  public async generateProductPack(input: GenerateProductPackInput): Promise<ProductMarketingPack> {
    const rawTitle = input.merchantHints?.title?.trim() || '';
    const rawDesc = input.merchantHints?.rawDescription?.trim() || '';

    const hasImage = !!(input.imageBuffer || input.imageBase64 || input.imageUrl);
    const hasHints = !!(
      input.merchantHints &&
      Object.keys(input.merchantHints).length > 0 &&
      (rawTitle || rawDesc || input.merchantHints.preferredTheme || input.merchantHints.brandName || input.merchantHints.targetPrice)
    );

    if (!hasImage && !hasHints) {
      throw new Error('EMPTY_PRODUCT_INPUT: At least one product image or description must be provided.');
    }

    // Truncate excessively long descriptions to prevent memory exhaustion (> 15000 chars)
    const sanitizedDesc = rawDesc.length > 15000 ? rawDesc.substring(0, 15000) + '...' : rawDesc;

    if (this.geminiClient.isLiveMode() && (input.imageBuffer || input.imageBase64)) {
      try {
        return await this.generateWithGeminiLive(input, sanitizedDesc);
      } catch (error) {
        console.warn('[ProductStudioService] Live generation failed, using mock generator:', error);
      }
    }

    return this.generateMockProductPack(input, sanitizedDesc);
  }

  /**
   * Generates Imagen 3 Prompts for 4 distinct Vietnamese merchant staging themes
   */
  public generateStudioPrompts(
    features: VisualFeatureExtractionResult,
    brandName = 'SME Brand'
  ): Record<ProductTheme, StudioStagingPrompt> {
    const primaryColorNames = (features.primaryColors || [{ name: 'Đỏ Ruby', hex: '#9B111E' }])
      .map(c => c.name)
      .join(', ');
    const materialsList = (features.materials || ['Lụa tơ tằm', 'Chất liệu cao cấp']).join(' and ');
    const subjectDesc = `${features.subCategory || features.category} crafted from ${materialsList}, in ${primaryColorNames} tones`;

    return {
      LUXURY_MINIMALIST: {
        theme: 'LUXURY_MINIMALIST',
        themeDisplayName: 'Sang Trọng Tối Giản (Luxury Minimalist)',
        prompt: `High-end commercial product photography of ${subjectDesc}, placed elegantly on a polished Italian Carrara marble pedestal with delicate natural gold veining. Clean neutral warm beige textured plaster background, minimalist architectural arches in soft focus. Soft diffused studio directional lighting with subtle gold rim reflections, elegant soft contact shadows beneath product. Ultra-sharp details, shot on Hasselblad H6D-100c 80mm f/2.8, photorealistic 8k, award-winning editorial lighting.`,
        negativePrompt: `cluttered background, noisy, oversaturated, harsh direct sunlight, intense black shadows, blurry, distorted geometry, watermark, text, low resolution, amateur photo, plastic look`,
        aspectRatio: '1:1',
        lightingStyle: 'Soft studio key light + subtle warm gold rim light',
        cameraSettings: 'Hasselblad 80mm f/2.8, ISO 100, 1/160s',
        suggestedProps: ['Carrara marble block', 'Gold leaf accent', 'Minimalist architectural arch']
      },

      NEON_CYBERPUNK: {
        theme: 'NEON_CYBERPUNK',
        themeDisplayName: 'Công Nghệ Tương Lai (Neon Cyberpunk)',
        prompt: `Futuristic cyberpunk product showcase of ${subjectDesc}, centered on a glossy dark obsidian glass surface with subtle wet puddle reflections. Dual-tone dramatic backlighting with vibrant electric cyan (#00FFFF) and intense magenta (#FF007F) LED tube glow lines. Ambient dark futuristic city grid with faint volumetric light haze in background. Ultra-modern aesthetic, cinematic moody contrast, shot on Sony A7R V 50mm f/1.2, ray-traced reflections, 8k crisp details.`,
        negativePrompt: `daylight, bright white background, natural sunlight, wooden furniture, rustic, warm vintage, desaturated, noisy artifacts, cartoonish, low contrast, washed out`,
        aspectRatio: '9:16',
        lightingStyle: 'Dual-tone Cyan & Magenta neon edge lighting + volumetric haze',
        cameraSettings: 'Sony A7R V 50mm f/1.2, ISO 400, 1/200s',
        suggestedProps: ['Obsidian glass base', 'Linear LED light bars', 'Subtle neon smoke mist']
      },

      PASTEL_COZY: {
        theme: 'PASTEL_COZY',
        themeDisplayName: 'Ấm Cúng Scandinavian (Pastel Cozy)',
        prompt: `Warm and cozy lifestyle product staging of ${subjectDesc}, resting gently on a natural light Scandinavian oak wooden tabletop layered with textured cream linen fabric. Soft morning golden-hour sunlight filtering through sheer linen curtains, casting gentle organic dappled shadows. Soft-focus background featuring pastel mint and buttercream ceramic cups and a small potted green eucalyptus plant. Peaceful homely aesthetic, shot on Canon EOS R5 85mm f/1.4, creamy bokeh, natural color grading.`,
        negativePrompt: `harsh flash, gloomy, cold blue tint, metallic industrial, dark heavy shadows, neon glow, pixelated, cluttered mess, artificial rendering, oversaturated HDR`,
        aspectRatio: '1:1',
        lightingStyle: 'Morning golden-hour window light + sheer curtain diffusion',
        cameraSettings: 'Canon EOS R5 85mm f/1.4, ISO 100, 1/250s',
        suggestedProps: ['Light oak table', 'Cream linen cloth', 'Eucalyptus ceramic vase']
      },

      TRADITIONAL_TET: {
        theme: 'TRADITIONAL_TET',
        themeDisplayName: 'Tết Cổ Truyền Việt Nam (Lunar New Year)',
        prompt: `Celebratory Vietnamese Lunar New Year (Tết Nguyên Đán) product centerpiece of ${subjectDesc}, placed atop an authentic Vietnamese hand-crafted dark mahogany lacquer tray (khay sơn mài) lined with rich red silk. Lush blooming golden yellow apricot blossoms (hoa mai vàng) and delicate pink peach blossoms (hoa đào Nhật Tân) framing the scene. Background decorated with soft-focus red couplets (câu đối đỏ), golden bronze coins, and elegant festive lanterns. Warm golden festive ambient lighting, rich imperial crimson (#C41E3A) and royal gold (#FFD700) color harmony, cinematic Vietnamese cultural elegance, 85mm f/2.0, 8k resolution.`,
        negativePrompt: `western christmas props, snow, cold winter, western decorations, dull desaturated colors, modern neon, messy, cheap plastic, text overlays, watermark, low quality`,
        aspectRatio: '1:1',
        lightingStyle: 'Warm celebratory golden glow + festive crimson ambient fill',
        cameraSettings: 'Sony A7R IV 85mm f/2.0, ISO 200, 1/125s',
        suggestedProps: ['Khay sơn mài khảm trai', 'Cành hoa mai vàng / hoa đào', 'Bao lì xì đỏ dát vàng', 'Đồng tiền tài lộc']
      }
    };
  }

  /**
   * Deterministic high-fidelity marketing pack generator
   */
  public generateMockProductPack(input: GenerateProductPackInput, sanitizedDesc?: string): ProductMarketingPack {
    const rawTitle = input.merchantHints?.title?.trim();
    const brandName = input.merchantHints?.brandName || 'An Yên Boutique';
    const preferredTheme: ProductTheme = input.merchantHints?.preferredTheme || 'TRADITIONAL_TET';
    const preferredTone: CopyTone = input.merchantHints?.preferredTone || 'FRIENDLY';

    const defaultTitle = rawTitle || 'Áo Dài Cách Tân Nữ Lụa Tơ Tằm Thêu Tay Hoa Mai';
    const targetPrice = input.merchantHints?.targetPrice || 589000;

    const extractedAttributes: VisualFeatureExtractionResult = {
      category: 'Thời Trang Nữ',
      subCategory: 'Áo Dài Cách Tân',
      material: '100% Lụa Tơ Tằm Hà Đông tự nhiên',
      materials: ['100% Lụa Tơ Tằm Hà Đông tự nhiên', 'Gấm Dệt Hoa Chìm', 'Chỉ Thêu Tay Thủ Công'],
      color: 'Đỏ Ruby & Vàng Hoàng Cúc',
      primaryColors: [
        { name: 'Đỏ Ruby Quý Phái', hex: '#9B111E' },
        { name: 'Vàng Hoàng Cúc', hex: '#FFD700' }
      ],
      accentColors: [
        { name: 'Xanh Ngọc Bích', hex: '#00A877' }
      ],
      keySellingPoints: [
        'Chất liệu lụa tơ tằm dệt thủ công làng Vạn Phúc mềm mại, thoáng mát cả ngày',
        'Họa tiết hoa mai thêu tay tinh xảo bởi nghệ nhân làng nghề truyền thống',
        'Form dáng cách tân tôn eo, che khuyết điểm hoàn hảo, phù hợp dạo phố và lễ Tết',
        'Công nghệ nhuộm màu thảo mộc tự nhiên bền màu, an toàn tuyệt đối cho làn da'
      ],
      targetAudience: 'Nữ giới 22-45 tuổi, nhân viên văn phòng, người yêu thích phong cách thanh lịch truyền thống',
      suggestedPriceRange: { min: 450000, max: 890000, currency: 'VND' },
      detectedObjects: ['Áo dài nữ', 'Cổ tròn đính ngọc', 'Tà áo thêu hoa mai', 'Quần lụa ống suông'],
      visualQualityScore: 0.96,
      brandVibe: 'Sang trọng, Tinh tế, Đậm đà Bản sắc Việt'
    };

    const studioPromptsMap = this.generateStudioPrompts(extractedAttributes, brandName);
    const activePromptObj = studioPromptsMap[preferredTheme];

    const studioPromptsData: StudioPromptsData = {
      prompt: activePromptObj.prompt,
      negativePrompt: activePromptObj.negativePrompt,
      aspectRatio: activePromptObj.aspectRatio,
      suggestedThemes: ['LUXURY_MINIMALIST', 'NEON_CYBERPUNK', 'PASTEL_COZY', 'TRADITIONAL_TET'],
      selectedTheme: preferredTheme,
      prompts: studioPromptsMap,
      activePrompt: activePromptObj,
      lightingStyle: activePromptObj.lightingStyle,
      cameraSettings: activePromptObj.cameraSettings,
      suggestedProps: activePromptObj.suggestedProps
    };

    const channelCopies: MultiChannelCopyResult = {
      facebook: {
        headline: `🌸 [SIÊU PHẨM TẾT 2026] ${defaultTitle.toUpperCase()} — TÔN VINH NÉT ĐẸP PHÁI NỮ 🌸`,
        body: `Bạn đang tìm kiếm một thiết kế vừa giữ trọn nét duyên dáng truyền thống, vừa hiện đại, thoáng mát để tự tin du xuân trẩy hội mà không lo gò bó?\n\n✨ 100% Lụa tơ tằm thượng hạng: Mềm như mây, nhẹ tựa sương, thấm hút mồ hôi cực tốt.\n🪡 Thêu tay hoa mai độc bản: Từng đường kim mũi chỉ được thực hiện tỉ mỉ trong 18 giờ.\n💃 Form dáng tôn dáng chuẩn Việt: Giấu nhẹm vòng 2, kéo dài chân tự nhiên.\n🎁 Tặng kèm: 01 bờm tóc lụa đồng điệu trị giá 120.000đ cho 50 đơn đầu tiên.\n\n⭐ Đã có hơn 3.200+ quý cô diện thiết kế này với 99.4% đánh giá 5 sao hài lòng!\n🔥 ƯU ĐÃI TRI ÂN: Giảm ngay 30% — Chỉ còn ${targetPrice.toLocaleString('vi-VN')}đ (Giá gốc 850.000đ). Miễn phí giao hàng toàn quốc khi đặt từ 2 áo.\n👉 Nhắn tin cho shop ngay hôm nay hoặc để lại SĐT để chuyên viên tư vấn size chuẩn xác nhất!`,
        callToAction: 'Nhắn tin cho shop ngay hôm nay để nhận ưu đãi có hạn nhé nàng ơi!',
        hashtags: ['#AoDaiCachTan', '#AoDaiTet2026', '#ThoiTrangNu', '#LuaToTam', '#SMEAutoPilot', '#AnYenBoutique'],
        hookAndProblem: 'Bạn đang tìm kiếm một thiết kế vừa giữ trọn nét duyên dáng truyền thống, vừa hiện đại, thoáng mát?',
        valueProposition: extractedAttributes.keySellingPoints,
        socialProof: '⭐ Đã có hơn 3.200+ khách hàng tin dùng & đánh giá 5 sao!',
        pricingAndPromo: `Ưu đãi chỉ còn ${targetPrice.toLocaleString('vi-VN')}đ (Giá gốc 850.000đ)`,
        fullPost: `🌸 [SIÊU PHẨM TẾT 2026] ${defaultTitle.toUpperCase()} 🌸\n\n✨ NÉT ĐẸP DI SẢN TRUYỀN THỐNG VIỆT NAM\n\n🔥 Giá ưu đãi: ${targetPrice.toLocaleString('vi-VN')}đ\n👉 Nhắn tin cho shop ngay!\n#SMEAutoPilot #AoDaiTet`
      },
      tiktokShop: {
        videoHook: 'Đừng vội mua áo dài Tết nếu bạn chưa biết đến bí quyết chọn lụa tơ tằm chuẩn này!',
        videoScript: '[HOOK]: Đừng vội mua áo dài Tết nếu bạn chưa biết điều này! [SCRIPT]: Cận cảnh chất lụa tơ tằm mềm mịn và họa tiết thêu tay tinh xảo. [CTA]: Bấm ngay vào giỏ hàng màu vàng góc trái màn hình để săn voucher giảm 50k nha!',
        soundRecommendation: 'Trending Upbeat Acoustic Tết Remix 2026 (Viral TikTok Sound)',
        hashtags: ['#TikTokShopVN', '#DealTet2026', '#AoDaiCachTan', '#XuHuongThoiTrang', '#ReviewHangTot'],
        storyboard: {
          scene1_hook: '[0-3s] Cận cảnh giọt nước trượt trên mặt lụa bóng mượt. Voiceover: "Mặc áo dài mà sợ bí bách thì xem ngay em này nha!"',
          scene2_showcase: '[4-12s] Người mẫu xoay 360 độ phô diễn tà áo thêu hoa mai óng ả dưới nắng xuân. Zoom cận cảnh đường thêu tay tinh xảo.',
          scene3_cta: '[13-20s] Chèn sticker voucher chớp nháy. Voiceover: "Đang có trợ giá độc quyền trên live, bấm ngay giỏ hàng màu vàng góc trái để nhận voucher nàng nha!"'
        },
        salesTagBadges: ['#TikTokShopVN', '#DealHot', '#AoDaiTet2026'],
        caption: 'Mẫu áo dài cứu cánh cho team sợ nóng ngày Tết 🌸 Bấm giỏ hàng góc trái săn voucher giảm 50k nha!'
      },
      zalo: {
        greeting: `Dạ Shop em chào Quý khách hàng thân thiết của ${brandName} ạ,`,
        customerTierGreeting: `Dạ Shop em chào Quý khách hàng VIP ạ,`,
        exclusiveVoucher: 'Mã voucher tri ân VIP: [VIP50K] — Giảm ngay 50.000đ khi đặt hôm nay.',
        featureHighlights: [
          'Lụa tơ tằm tự nhiên cao cấp, thoáng mát, không nhăn',
          'Thêu tay hoa mai độc quyền đón tài lộc năm mới',
          'Được kiểm tra hàng và thử đồ trước khi thanh toán'
        ],
        directOrderLink: 'https://smeautopilot.vn/order/anyen-aodai-vip',
        closingSignature: 'Chúc anh/chị một ngày an lành! Hotline VIP: 1900-6868.',
        promotionText: `Tặng voucher VIP50K giảm trực tiếp 50k cho đơn đặt hôm nay!`,
        fullMessage: `Dạ Shop em chào Quý khách thân thiết ạ!\nShop trân trọng gửi tặng riêng anh/chị mã ưu đãi VIP: [VIP50K] giảm ngay 50.000đ.\nLink: https://smeautopilot.vn/order/anyen-aodai-vip`
      },
      shopee: {
        seoTitle: `[Mã TET2026 Giảm 20%] ${defaultTitle} Dáng Suông Tôn Dáng Cao Cấp ${brandName} AD-01`,
        bulletPoints: [
          '📌 THÔNG TIN SẢN PHẨM: Áo Dài Cách Tân form suông nhẹ nhàng, chất liệu lụa tơ tằm dệt cao cấp mềm rũ tự nhiên, có lót lụa habutai êm ái.',
          '✨ HỌA TIẾT ĐỘC QUYỀN: Thêu tay hoa mai vàng thủ công 100%, đường kim mũi chỉ sắc nét, đính ngọc trai cổ áo sang trọng.',
          '🛡️ CAM KẾT CHÍNH HÃNG: Hàng thiết kế chuẩn thương hiệu, hình ảnh thật 100%, đổi trả miễn phí trong 7 ngày nếu không vừa size.'
        ],
        searchKeywords: [
          'ao dai cach tan',
          'ao dai tet 2026',
          'ao dai to tam',
          'ao dai nu theu tay',
          'ao dai du xuan',
          'thoi trang nu cao cap'
        ],
        detailedDescription: `Áo Dài Cách Tân Nữ Lụa Tơ Tằm Thêu Tay — Thiết kế độc quyền từ ${brandName}.\n\nĐẶC ĐIỂM NỔI BẬT:\n- Chất liệu lụa tơ tằm mềm mại, thoáng mát.\n- Đổi trả 7 ngày miễn phí.`,
        usageAndCareGuide: 'Giặt tay bằng nước mát hoặc dầu gội nhẹ. Phơi nơi thoáng mát tránh ánh nắng gắt.'
      }
    };

    let mappedTonePreset: 'friendly' | 'luxury' | 'youthful' | 'urgent_sale' = 'friendly';
    if (preferredTone === 'LUXURY_ELEGANT' || preferredTone === 'luxury') mappedTonePreset = 'luxury';
    else if (preferredTone === 'GEN_Z_TRENDY' || preferredTone === 'youthful') mappedTonePreset = 'youthful';
    else if (preferredTone === 'FLASH_SALE_URGENT' || preferredTone === 'urgent_sale') mappedTonePreset = 'urgent_sale';

    return {
      productTitle: defaultTitle,
      extractedAttributes,
      studioPrompts: studioPromptsData,
      channelCopies,
      tonePreset: mappedTonePreset,
      generatedAt: new Date().toISOString(),
      metadata: {
        generatedAt: new Date().toISOString(),
        modelUsed: 'mock-engine',
        isMock: true
      }
    };
  }

  private async generateWithGeminiLive(
    input: GenerateProductPackInput,
    sanitizedDesc: string
  ): Promise<ProductMarketingPack> {
    const promptPart = input.imageBase64
      ? GeminiClientService.base64ToGenerativePart(input.imageBase64)
      : GeminiClientService.bufferToGenerativePart(input.imageBuffer!, 'image/jpeg');

    const promptText = `
You are the Lead E-Commerce Product Studio & Copywriting AI for Vietnamese online sellers.
Analyze this product image and context:
Description: "${sanitizedDesc}"
Hints: ${JSON.stringify(input.merchantHints || {})}

Return a structured JSON marketing pack matching:
{
  "productTitle": "...",
  "extractedAttributes": {
    "category": "...",
    "subCategory": "...",
    "materials": ["..."],
    "primaryColors": [{"name": "...", "hex": "#..."}],
    "accentColors": [{"name": "...", "hex": "#..."}],
    "keySellingPoints": ["...", "..."],
    "targetAudience": "...",
    "suggestedPriceRange": {"min": 150000, "max": 450000, "currency": "VND"},
    "detectedObjects": ["..."],
    "visualQualityScore": 0.9,
    "brandVibe": "..."
  },
  "channelCopies": {
    "facebook": {
      "headline": "...",
      "body": "...",
      "callToAction": "...",
      "hashtags": ["#..."]
    },
    "tiktokShop": {
      "videoHook": "...",
      "videoScript": "...",
      "soundRecommendation": "...",
      "hashtags": ["#..."]
    },
    "zalo": {
      "greeting": "...",
      "promotionText": "...",
      "directOrderLink": "..."
    },
    "shopee": {
      "seoTitle": "...",
      "bulletPoints": ["...", "...", "..."],
      "searchKeywords": ["..."]
    }
  }
}
    `;

    const result = await this.geminiClient.generateJson<any>({
      model: 'gemini-2.0-flash',
      prompt: [promptPart, { text: promptText }],
      mockFallback: () => this.generateMockProductPack(input, sanitizedDesc)
    });

    const studioPromptsMap = this.generateStudioPrompts(
      result.extractedAttributes,
      input.merchantHints?.brandName || 'SME Brand'
    );
    const preferredTheme: ProductTheme = input.merchantHints?.preferredTheme || 'TRADITIONAL_TET';
    const activePrompt = studioPromptsMap[preferredTheme];

    return {
      productTitle: result.productTitle || input.merchantHints?.title || 'Sản Phẩm Cao Cấp',
      extractedAttributes: result.extractedAttributes,
      studioPrompts: {
        prompt: activePrompt.prompt,
        negativePrompt: activePrompt.negativePrompt,
        aspectRatio: activePrompt.aspectRatio,
        suggestedThemes: ['LUXURY_MINIMALIST', 'NEON_CYBERPUNK', 'PASTEL_COZY', 'TRADITIONAL_TET'],
        selectedTheme: preferredTheme,
        prompts: studioPromptsMap,
        activePrompt,
        lightingStyle: activePrompt.lightingStyle,
        cameraSettings: activePrompt.cameraSettings,
        suggestedProps: activePrompt.suggestedProps
      },
      channelCopies: result.channelCopies,
      tonePreset: 'friendly',
      generatedAt: new Date().toISOString(),
      metadata: {
        generatedAt: new Date().toISOString(),
        modelUsed: 'gemini-2.0-flash',
        isMock: false
      }
    };
  }
}

// Global Singleton
let defaultStudioService: ProductStudioService | null = null;

export function getProductStudioService(): ProductStudioService {
  if (!defaultStudioService) {
    defaultStudioService = new ProductStudioService();
  }
  return defaultStudioService;
}
