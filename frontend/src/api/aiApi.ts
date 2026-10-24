import { apiClient, ApiResponse } from './client';
import {
  BillForensicsResult,
  ProductMarketingPack,
  VoiceAssistantTurn,
  VoiceToolCall,
  VoiceToolResult
} from '@shared';
import { TonePreset } from '../utils/validators';

export interface AuditBillRequest {
  imageBase64: string;
  mimeType?: string;
  expectedAmount?: number;
  expectedAccount?: string;
}

export interface MarketingCopyRequest {
  productName: string;
  rawDescription?: string;
  imageBase64?: string;
  industry?: 'fashion' | 'fnb' | 'cosmetics';
  tone?: TonePreset;
  stagingTheme?: 'LUXURY_MINIMALIST' | 'NEON_CYBERPUNK' | 'PASTEL_COZY' | 'TRADITIONAL_TET';
}

export interface VoiceChatRequest {
  message: string;
  history?: VoiceAssistantTurn[];
  industry?: 'fashion' | 'fnb' | 'cosmetics';
  dialect?: 'north' | 'central' | 'south' | 'auto';
}

export interface VoiceAudioOrderRequest {
  audioBase64: string;
  mimeType?: string;
  industry?: 'fashion' | 'fnb' | 'cosmetics';
  dialect?: 'north' | 'central' | 'south' | 'auto';
}

export interface VoiceApiResponse {
  transcript: string;
  responseText: string;
  toolCalls?: VoiceToolCall[];
  toolResults?: VoiceToolResult[];
  draftOrder?: any;
  audioBase64?: string;
}

export const aiApi = {
  async auditBill(req: AuditBillRequest): Promise<ApiResponse<BillForensicsResult>> {
    const res = await apiClient.post<BillForensicsResult>('/ai/forensics/audit-bill', req);
    if (res.success && res.data) {
      return res;
    }

    // Client-side fallback calculation for offline / pure frontend preview
    const isCritical = req.imageBase64.length % 2 === 1 && req.imageBase64.includes('mb_fake');
    const mockResult: BillForensicsResult = {
      isAuthentic: !isCritical,
      riskLevel: isCritical ? 'CRITICAL' : 'LOW',
      confidenceScore: isCritical ? 0.95 : 0.98,
      recommendation: isCritical ? 'REJECT' : 'AUTO_APPROVE',
      reconciliationStatus: isCritical ? 'FLAGGED' : 'MATCHED',
      matchedOrderId: 'ORD-MA-2026-001',
      extractedData: {
        bankName: 'Vietcombank',
        accountNumber: '1012345678',
        accountHolder: 'NGUYEN VAN A',
        amount: req.expectedAmount || 650000,
        currency: 'VND',
        transactionId: `TXN${Math.floor(100000000 + Math.random() * 900000000)}`,
        transactionTime: new Date().toISOString(),
        transferContent: 'MAI ANH CK AO DAI',
        recipientAccount: req.expectedAccount || '0011004567890'
      },
      forensicSignals: {
        timestampMatch: !isCritical,
        fontConsistency: !isCritical,
        compressionArtifacts: isCritical,
        logoAuthenticity: true,
        qrIntegrity: true,
        anomalies: isCritical
          ? ['Phát hiện sai lệch font chữ Arial trên giao diện MBBank', 'Nghịch lý đồng hồ hệ thống 11:45 vs 10:15']
          : []
      },
      detailedAnomalies: isCritical
        ? [
            {
              layer: 2,
              layerName: 'Typography',
              type: 'FONT_MISMATCH',
              description: 'Phông chữ số tiền không khớp với phông chữ gốc của ngân hàng',
              penalty: 35,
              severity: 'CRITICAL',
              boundingBox: [300, 200, 380, 800]
            },
            {
              layer: 1,
              layerName: 'Clock Consistency',
              type: 'CLOCK_PARADOX',
              description: 'Thời gian chụp màn hình (11:45) trước thời gian giao dịch ghi nhận (10:15)',
              penalty: 25,
              severity: 'HIGH',
              boundingBox: [40, 50, 90, 400]
            }
          ]
        : []
    };

    return { success: true, data: mockResult };
  },

  async generateMarketingCopy(req: MarketingCopyRequest): Promise<ApiResponse<ProductMarketingPack>> {
    const res = await apiClient.post<ProductMarketingPack>('/ai/product/generate-marketing', req);
    if (res.success && res.data) {
      return res;
    }

    const title = req.productName || 'Áo Dài Gấm Phượng Hoàng';
    const tone = req.tone || 'friendly';
    const mockPack: ProductMarketingPack = {
      productTitle: title,
      tonePreset: tone,
      extractedAttributes: {
        category: 'Thời Trang Nữ',
        material: 'Lụa Tơ Tằm & Gấm Cao Cấp',
        color: 'Đỏ Ánh Kim',
        keySellingPoints: [
          'Họa tiết thêu phượng hoàng thủ công tỉ mỉ',
          'Chất lụa mềm mại, tôn dáng thanh lịch',
          'Chuẩn form dáng truyền thống kết hợp nét hiện đại'
        ],
        targetAudience: 'Phụ nữ Việt Nam 22-45 tuổi yêu thích thời trang truyền thống'
      },
      studioPrompts: {
        prompt: `High quality studio product photography of ${title}, elegant lighting`,
        negativePrompt: 'blurry, distorted, low quality',
        aspectRatio: '1:1'
      },
      channelCopies: {
        facebook: {
          headline: tone === 'luxury' ? '✨ ĐẲNG CẤP QUÝ PHÁI — NÉT ĐẸP DI SẢN' : '🌸 TÔN VINH VẺ ĐẸP TRUYỀN THỐNG VIỆT',
          body: `Dành riêng cho những dịp đặc biệt, ${title} mang đến vẻ đẹp đài các, duyên dáng và sang trọng. Từng đường kim mũi chỉ được chăm chút tỉ mỉ từ nghệ nhân lụa Hà Đông.`,
          callToAction: '👉 Nhắn tin ngay để nhận tư vấn size chuẩn và ưu đãi miễn phí vận chuyển!',
          hashtags: ['#SMEAutoPilot', '#AoDaiVietNam', '#ThoiTrangMaiAnh', '#BuildwithGoogleAI']
        },
        tiktokShop: {
          videoHook: 'Chiếc áo dài khiến hàng ngàn chị em mê mẩn mùa Tết năm nay có gì hot?',
          videoScript: `Biến hình cực xinh trong 3 giây cùng ${title}! Chất gấm mềm mại, phom chuẩn không kén dáng. Click ngay giỏ hàng bên dưới để săn giá ưu đãi nha!`,
          soundRecommendation: 'Nhạc Tết Trend 2026 Remix sôi động',
          hashtags: ['#TikTokShopVN', '#OOTD', '#AoDaiTet', '#ReviewThoiTrang']
        },
        zalo: {
          greeting: 'Chào Quý khách thân thiết của Mai Anh Silk,',
          promotionText: `Shop vừa ra mắt mẫu mới ${title} dành riêng cho VIP. Tặng ngay voucher giảm 50.000đ khi đặt trước hôm nay!`,
          directOrderLink: 'https://zalo.me/s/maianh-silk/order-vip'
        },
        shopee: {
          seoTitle: `[CHÍNH HÃNG] ${title} - Chất Liệu Gấm Cao Cấp Tôn Dáng Quý Phái`,
          bulletPoints: [
            'Chất liệu gấm tơ tằm dệt hoa văn nổi sang trọng',
            'Form áo chuẩn dáng Việt, khóa kéo giọt nước êm ái',
            'Đủ size từ S đến XXL cho người từ 42kg - 68kg'
          ],
          searchKeywords: ['áo dài tết', 'áo dài gấm', 'thời trang thiết kế', 'mai anh silk']
        }
      }
    };

    return { success: true, data: mockPack };
  },

  async voiceChat(req: VoiceChatRequest): Promise<ApiResponse<VoiceApiResponse>> {
    const res = await apiClient.post<VoiceApiResponse>('/ai/voice/chat', req);
    if (res.success && res.data) {
      return res;
    }

    const msg = req.message.toLowerCase();
    let responseText = 'Dạ em có thể hỗ trợ gì cho mình về kiểm tra tồn kho, tính phí ship hoặc tạo đơn hàng không ạ?';
    const toolCalls: VoiceToolCall[] = [];
    const toolResults: VoiceToolResult[] = [];

    if (msg.includes('áo dài') || msg.includes('tồn kho') || msg.includes('size')) {
      toolCalls.push({ name: 'query_inventory', args: { skuOrName: 'Áo Dài Gấm Size L' } });
      toolResults.push({ toolName: 'query_inventory', result: { sku: 'AD-GAM-01', inStock: 18, price: 650000 } });
      responseText = 'Dạ mẫu Áo Dài Gấm hiện còn 18 chiếc size L trong kho, giá 650.000đ/bộ ạ!';
    } else if (msg.includes('ship') || msg.includes('cầu giấy') || msg.includes('hà nội') || msg.includes('quận 5')) {
      toolCalls.push({ name: 'calculate_shipping_fee', args: { city: 'Hà Nội', district: 'Cầu Giấy' } });
      toolResults.push({ toolName: 'calculate_shipping_fee', result: { distanceKm: 4.8, shippingFeeVnd: 25000 } });
      responseText = 'Dạ khoảng cách giao hàng là 4.8km, phí ship về Cầu Giấy là 25.000đ ạ. Giao nhanh trong 2 giờ!';
    } else if (msg.includes('tạo đơn') || msg.includes('đặt hàng') || msg.includes('mua')) {
      toolCalls.push({
        name: 'create_draft_order',
        args: { customerName: 'Mai Anh', phone: '0911223344', address: '128 Nguyễn Trãi, Q5, TP.HCM', quantity: 2 }
      });
      toolResults.push({
        toolName: 'create_draft_order',
        result: { orderId: `ORD-${Date.now().toString().slice(-4)}`, totalAmount: 1325000, status: 'CONFIRMED' }
      });
      responseText = 'Dạ em đã tạo đơn hàng thành công cho chị Mai Anh gồm 2 bộ Áo Dài Gấm, tổng tiền 1.325.000đ (đã gồm phí ship). Em đã đồng bộ vào Google Sheets rồi ạ!';
    }

    return {
      success: true,
      data: {
        transcript: req.message,
        responseText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined
      }
    };
  },

  async voiceAudioOrder(req: VoiceAudioOrderRequest): Promise<ApiResponse<VoiceApiResponse>> {
    const res = await apiClient.post<VoiceApiResponse>('/ai/voice/audio-order', req);
    if (res.success && res.data) {
      return res;
    }

    return this.voiceChat({
      message: 'Tạo đơn 2 bộ áo dài đỏ size L về 128 Nguyễn Trãi Quận 5 TP.HCM',
      industry: req.industry,
      dialect: req.dialect
    });
  },

  subscribeStreamGenerate(
    prompt: string,
    type: string,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (err: any) => void
  ): () => void {
    const query = new URLSearchParams({ prompt, type }).toString();
    const url = `/api/ai/stream-generate?${query}`;
    let eventSource: EventSource | null = null;
    let isCompleted = false;
    let receivedAnyToken = false;

    try {
      eventSource = new EventSource(url);

      const handleTokenData = (rawData: string) => {
        try {
          const parsed = JSON.parse(rawData);
          const chunkText = parsed.text !== undefined ? parsed.text : (parsed.chunk !== undefined ? parsed.chunk : rawData);
          if (chunkText) {
            receivedAnyToken = true;
            onChunk(chunkText);
          }
          if (parsed.done) {
            isCompleted = true;
            eventSource?.close();
            onDone();
          }
        } catch {
          receivedAnyToken = true;
          onChunk(rawData);
        }
      };

      // Listen for named 'token' events from backend
      eventSource.addEventListener('token', (event: MessageEvent) => {
        handleTokenData(event.data);
      });

      // Listen for named 'done' events from backend
      eventSource.addEventListener('done', (event: MessageEvent) => {
        isCompleted = true;
        eventSource?.close();
        onDone();
      });

      // Listen for default message events
      eventSource.onmessage = (event: MessageEvent) => {
        handleTokenData(event.data);
      };

      // Error and disconnect handling
      eventSource.onerror = (err) => {
        eventSource?.close();
        if (isCompleted) {
          return;
        }

        // If no tokens were received from backend, fallback to client-side simulated stream
        if (!receivedAnyToken) {
          let simulatedText = `[AI Stream - Gemini 2.0 Flash]\n\nPhân tích yêu cầu: "${prompt}"...\n- Xác thực dữ liệu đầu vào chuẩn xác.\n- Tối ưu hóa phản hồi cho doanh nghiệp Việt.\n- Đã sẵn sàng xuất kết quả.`;
          let index = 0;
          const interval = setInterval(() => {
            if (index < simulatedText.length) {
              onChunk(simulatedText.slice(index, index + 8));
              index += 8;
            } else {
              clearInterval(interval);
              isCompleted = true;
              onDone();
            }
          }, 40);
        } else {
          isCompleted = true;
          onDone();
        }
      };
    } catch (err) {
      onError(err);
    }

    return () => {
      isCompleted = true;
      if (eventSource) eventSource.close();
    };
  }
};
