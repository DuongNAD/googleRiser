import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  createMockProductMarketingPack
} from '../harness';
import { ProductMarketingPack } from '../../shared';
import { TonePreset, generateVietnameseCopy } from '../helpers/mockServices';

export class StudioWorkbenchState {
  private activeImage: string | null = null;
  private productTitle: string = '';
  private currentTone: TonePreset = 'friendly';
  private generatedPack: ProductMarketingPack | null = null;
  private activeTab: 'facebook' | 'tiktokShop' | 'zalo' | 'shopee' = 'facebook';

  setImage(base64: string): void {
    this.activeImage = base64;
  }

  getImage(): string | null {
    return this.activeImage;
  }

  setProductTitle(title: string): void {
    this.productTitle = title;
  }

  getProductTitle(): string {
    return this.productTitle;
  }

  setTone(tone: TonePreset): void {
    this.currentTone = tone;
    if (this.generatedPack) {
      this.generatedPack.tonePreset = tone;
      this.generatedPack.channelCopies = generateVietnameseCopy(
        {
          title: this.productTitle || this.generatedPack.productTitle,
          category: this.generatedPack.extractedAttributes.category,
          price: 450000,
          highlights: this.generatedPack.extractedAttributes.keySellingPoints
        },
        tone
      );
    }
  }

  getTone(): TonePreset {
    return this.currentTone;
  }

  setGeneratedPack(pack: ProductMarketingPack): void {
    this.generatedPack = pack;
    this.productTitle = pack.productTitle;
    this.currentTone = pack.tonePreset || 'friendly';
  }

  getGeneratedPack(): ProductMarketingPack | null {
    return this.generatedPack;
  }

  setActiveTab(tab: 'facebook' | 'tiktokShop' | 'zalo' | 'shopee'): void {
    this.activeTab = tab;
  }

  getActiveTab(): string {
    return this.activeTab;
  }

  exportFormattedCopy(channel: 'facebook' | 'tiktokShop' | 'zalo' | 'shopee'): string {
    if (!this.generatedPack) return '';
    const copies = this.generatedPack.channelCopies;

    if (channel === 'facebook') {
      const fb = copies.facebook;
      return `${fb.headline}\n\n${fb.body}\n\n${fb.callToAction}\n\n${fb.hashtags.join(' ')}`;
    } else if (channel === 'tiktokShop') {
      const tt = copies.tiktokShop;
      return `[HOOK]: ${tt.videoHook}\n\n[SCRIPT]: ${tt.videoScript}\n\n[SOUND]: ${tt.soundRecommendation}\n\n${tt.hashtags.join(' ')}`;
    } else if (channel === 'zalo') {
      const zl = copies.zalo;
      return `${zl.greeting}\n\n${zl.promotionText}\n\nLink: ${zl.directOrderLink}`;
    } else {
      const sp = copies.shopee;
      return `${sp.seoTitle}\n\n${sp.bulletPoints.join('\n')}\n\nTags: ${sp.searchKeywords.join(', ')}`;
    }
  }
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

describe('F13: Product Studio UI & AI Studio Playground State', () => {
  test('Test 13.1: Studio workbench state management and image staging', () => {
    const workbench = new StudioWorkbenchState();
    assertEqual(workbench.getImage(), null);

    workbench.setImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    assertTrue(workbench.getImage()?.startsWith('data:image/png;base64') ?? false);

    workbench.setProductTitle('Áo Dài Gấm Phượng Hoàng');
    assertEqual(workbench.getProductTitle(), 'Áo Dài Gấm Phượng Hoàng');
  });

  test('Test 13.2: Interactive tone preset switcher and real-time copy updating', () => {
    const workbench = new StudioWorkbenchState();
    const mockPack = createMockProductMarketingPack();
    workbench.setGeneratedPack(mockPack);

    workbench.setTone('luxury');
    assertEqual(workbench.getTone(), 'luxury');
    assertContains(workbench.getGeneratedPack()?.channelCopies.facebook.headline || '', 'ĐẲNG CẤP');

    workbench.setTone('urgent_sale');
    assertEqual(workbench.getTone(), 'urgent_sale');
    assertContains(workbench.getGeneratedPack()?.channelCopies.facebook.headline || '', 'XẢ KHO');
  });

  test('Test 13.3: Multi-channel preview tab switching and content rendering', () => {
    const workbench = new StudioWorkbenchState();
    workbench.setGeneratedPack(createMockProductMarketingPack());

    workbench.setActiveTab('tiktokShop');
    assertEqual(workbench.getActiveTab(), 'tiktokShop');

    workbench.setActiveTab('shopee');
    assertEqual(workbench.getActiveTab(), 'shopee');
  });

  test('Test 13.4: Gemini 2.0 Prompt Playground parameter configuration & limits', () => {
    const validConfig: PromptPlaygroundConfig = {
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 2048,
      systemInstruction: 'You are an e-commerce copywriting assistant.'
    };
    assertTrue(validatePlaygroundConfig(validConfig).valid);

    const invalidTemp: PromptPlaygroundConfig = { ...validConfig, temperature: 2.5 };
    assertFalse(validatePlaygroundConfig(invalidTemp).valid);

    const invalidTokens: PromptPlaygroundConfig = { ...validConfig, maxOutputTokens: 10000 };
    assertFalse(validatePlaygroundConfig(invalidTokens).valid);
  });

  test('Test 13.5: Export and copy-to-clipboard formatting for social channels', () => {
    const workbench = new StudioWorkbenchState();
    workbench.setGeneratedPack(createMockProductMarketingPack());

    const fbExport = workbench.exportFormattedCopy('facebook');
    assertContains(fbExport, '✨ NÉT ĐẸP DI SẢN');
    assertContains(fbExport, '#SMEAutoPilot');

    const ttExport = workbench.exportFormattedCopy('tiktokShop');
    assertContains(ttExport, '[HOOK]:');
    assertContains(ttExport, '[SCRIPT]:');

    const zlExport = workbench.exportFormattedCopy('zalo');
    assertContains(zlExport, 'Link:');
  });
});
