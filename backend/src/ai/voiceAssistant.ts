/**
 * SME AutoPilot — Vietnamese Voice & Conversational Assistant
 * backend/src/ai/voiceAssistant.ts
 *
 * Implements Multi-Dialect Vietnamese Conversational AI (Bắc, Trung, Nam),
 * audio buffer & transcript handling, multi-turn session cart management,
 * and Gemini 2.0 Function Calling dispatch.
 */

import {
  VoiceAssistantSessionState,
  VoiceAssistantResponse,
  RegionalDialect
} from '../../../shared/types/ai';
import { GeminiClientService, getGeminiClient } from './geminiClient';
import { toolDeclarations, executeToolCall, inventoryDB } from './tools';

export interface ProcessVoiceInput {
  sessionId: string;
  userText?: string;
  audioBuffer?: Buffer;
  audioMimeType?: string;
  dialectHint?: RegionalDialect;
  sessionState?: Partial<VoiceAssistantSessionState>;
}

export class VoiceAssistantService {
  private geminiClient: GeminiClientService;
  private sessions: Map<string, VoiceAssistantSessionState> = new Map();

  constructor(geminiClient?: GeminiClientService) {
    this.geminiClient = geminiClient || getGeminiClient();
  }

  /**
   * Processes a voice or chat turn
   */
  public async processVoiceTurn(input: ProcessVoiceInput): Promise<VoiceAssistantResponse> {
    // 1. Get or initialize session state
    let state = this.sessions.get(input.sessionId) || {
      sessionId: input.sessionId,
      detectedDialect: input.dialectHint || 'NORTHERN',
      cart: [],
      history: []
    };

    if (input.sessionState) {
      state = { ...state, ...input.sessionState };
    }

    if (this.geminiClient.isLiveMode() && (input.userText || input.audioBuffer)) {
      try {
        return await this.processWithGeminiLive(input, state);
      } catch (error) {
        console.warn('[VoiceAssistantService] Live turn failed, using mock turn:', error);
      }
    }

    return this.processMockTurn(input, state);
  }

  /**
   * Retrieves current session state
   */
  public getSession(sessionId: string): VoiceAssistantSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Clears or resets a session
   */
  public clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Deterministic mock conversational engine with dialect heuristics and tool triggers
   */
  public async processMockTurn(
    input: ProcessVoiceInput,
    state: VoiceAssistantSessionState
  ): Promise<VoiceAssistantResponse> {
    const rawText = (input.userText || '').toLowerCase();
    const executedToolCalls: Array<{ toolName: string; args: any; result: any }> = [];
    let responseText = '';
    const quickReplies: string[] = ['Xem mẫu áo dài', 'Tính phí ship Hà Nội', 'Áp mã TET2026', 'Tạo đơn ngay'];

    // Dialect Heuristic (token-aware matching)
    const words = rawText.split(/[\s,?.!]+/).filter(Boolean);
    const hasCentral =
      words.some(w => ['răng', 'rứa', 'mô', 'tê', 'hè'].includes(w)) ||
      rawText.includes('chi rứa') ||
      rawText.includes('bớt hè');
    const hasSouthern =
      words.some(w => ['hông', 'nè', 'nghen', 'zậy', 'hén'].includes(w)) ||
      (rawText.includes('nhiêu') && !rawText.includes('bao nhiêu')) ||
      rawText.includes('dạ shop');

    if (hasCentral) {
      state.detectedDialect = 'CENTRAL';
    } else if (hasSouthern) {
      state.detectedDialect = 'SOUTHERN';
    } else {
      state.detectedDialect = 'NORTHERN';
    }

    // Intent Routing
    if (
      rawText.includes('tồn kho') ||
      rawText.includes('còn hàng') ||
      rawText.includes('áo dài') ||
      rawText.includes('giá') ||
      rawText.includes('size') ||
      rawText.includes('mẫu')
    ) {
      const toolRes = await executeToolCall(
        'query_inventory',
        { productName: 'Áo Dài Cách Tân' },
        { sessionId: input.sessionId, state }
      );
      executedToolCalls.push({ toolName: 'query_inventory', args: { productName: 'Áo Dài Cách Tân' }, result: toolRes });

      if (state.detectedDialect === 'CENTRAL') {
        responseText = `Dạ mẫu Áo Dài Cách Tân Tơ Tằm bên em còn đủ size S, M, L nha anh/chị. Giá ưu đãi là 589.000đ rứa ạ! Anh/chị ưng màu đỏ hay vàng hè?`;
      } else if (state.detectedDialect === 'SOUTHERN') {
        responseText = `Dạ Áo Dài Cách Tân Tơ Tằm bên em đang sẵn hàng đủ size S, M, L nè anh/chị. Giá ưu đãi chỉ 589.000đ thôi nghen. Anh/chị chọn size nào dạ?`;
      } else {
        responseText = `Dạ Áo Dài Cách Tân Tơ Tằm bên em hiện còn sẵn đủ size S, M, L ạ. Giá đang khuyến mãi chỉ 589.000đ. Anh/chị mặc size gì để em kiểm tra chi tiết ạ?`;
      }
    } else if (
      rawText.includes('ship') ||
      rawText.includes('vận chuyển') ||
      rawText.includes('giao hàng') ||
      rawText.includes('hà nội') ||
      rawText.includes('hcm') ||
      rawText.includes('đà nẵng')
    ) {
      const province = rawText.includes('hà nội')
        ? 'Hà Nội'
        : rawText.includes('đà nẵng')
        ? 'Đà Nẵng'
        : 'Hồ Chí Minh';
      const toolRes = await executeToolCall(
        'calculate_shipping_fee',
        { province, weightGram: 500 },
        { sessionId: input.sessionId, state }
      );
      executedToolCalls.push({
        toolName: 'calculate_shipping_fee',
        args: { province, weightGram: 500 },
        result: toolRes
      });

      responseText = `Dạ phí giao hàng tiêu chuẩn về ${province} là ${toolRes.shippingFee.toLocaleString('vi-VN')}đ, dự kiến nhận hàng sau 1-2 ngày ạ. Nếu đơn trên 500k bên em freeship luôn nha anh/chị!`;
    } else if (
      rawText.includes('voucher') ||
      rawText.includes('mã') ||
      rawText.includes('giảm giá') ||
      rawText.includes('khuyến mãi') ||
      rawText.includes('tet2026')
    ) {
      const code = rawText.includes('freeship') ? 'FREESHIP' : rawText.includes('vip') ? 'VIP50K' : 'TET2026';
      const toolRes = await executeToolCall(
        'apply_discount_voucher',
        { voucherCode: code, orderSubtotal: 589000 },
        { sessionId: input.sessionId, state }
      );
      executedToolCalls.push({
        toolName: 'apply_discount_voucher',
        args: { voucherCode: code, orderSubtotal: 589000 },
        result: toolRes
      });

      if (toolRes.isValid) {
        state.appliedVoucher = { code, discountAmount: toolRes.discountAmount };
        responseText = `Dạ tuyệt vời quá! Mã [${code}] hợp lệ, anh/chị được giảm ngay ${toolRes.discountAmount.toLocaleString('vi-VN')}đ, tổng thanh toán chỉ còn ${toolRes.finalTotal.toLocaleString('vi-VN')}đ thôi ạ!`;
      } else {
        responseText = `Dạ mã giảm giá [${code}] chưa áp dụng được do: ${toolRes.message}`;
      }
    } else if (
      rawText.includes('đặt hàng') ||
      rawText.includes('mua') ||
      rawText.includes('tạo đơn') ||
      rawText.includes('lấy 1') ||
      rawText.includes('chốt đơn')
    ) {
      const orderArgs = {
        customerName: state.customerName || 'Nguyễn Thị Mai',
        customerPhone: state.customerPhone || '0912345678',
        shippingAddress: state.shippingAddress || {
          street: '123 Đường Cầu Giấy',
          ward: 'Dịch Vọng',
          district: 'Cầu Giấy',
          province: 'Hà Nội'
        },
        items:
          state.cart.length > 0
            ? state.cart
            : [
                {
                  sku: 'AD-TET-01-RED-M',
                  productName: 'Áo Dài Cách Tân Tơ Tằm Đỏ (Size M)',
                  quantity: 1,
                  unitPrice: 589000
                }
              ],
        paymentMethod: 'COD' as const
      };
      const toolRes = await executeToolCall('create_draft_order', orderArgs, {
        sessionId: input.sessionId,
        state
      });
      executedToolCalls.push({ toolName: 'create_draft_order', args: orderArgs, result: toolRes });

      state.cart = [];
      responseText = `Dạ em đã tạo thành công đơn hàng mã #${toolRes.orderId} cho bạn rồi ạ. Tổng thanh toán là ${toolRes.finalAmount.toLocaleString('vi-VN')}đ khi nhận hàng (COD). Em cảm ơn bạn nhiều nha!`;
    } else if (
      rawText.includes('tra cứu') ||
      rawText.includes('kiểm tra đơn') ||
      rawText.includes('đơn hàng của tôi') ||
      rawText.includes('ord-vn')
    ) {
      const toolRes = await executeToolCall(
        'track_order_status',
        { customerPhone: '0912345678' },
        { sessionId: input.sessionId, state }
      );
      executedToolCalls.push({
        toolName: 'track_order_status',
        args: { customerPhone: '0912345678' },
        result: toolRes
      });

      responseText = `Dạ đơn hàng #${toolRes.orderId} của bạn đang ở trạng thái: [${toolRes.statusText}]. Shipper GHTK đang giao hàng, dự kiến đến trước 17h hôm nay ạ!`;
    } else {
      responseText = `Dạ em chào anh/chị! Em là trợ lý bán hàng SME AutoPilot. Em có thể giúp anh/chị kiểm tra mẫu áo dài, tính phí ship hoặc tạo đơn hàng nhanh chóng ạ!`;
    }

    state.history.push({
      role: 'user',
      content: input.userText || '[Giọng nói tiếng Việt]',
      timestamp: new Date().toISOString()
    });
    state.history.push({
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString()
    });
    this.sessions.set(input.sessionId, state);

    return {
      sessionId: input.sessionId,
      responseText,
      detectedDialect: state.detectedDialect,
      toolCallsExecuted: executedToolCalls,
      sessionState: state,
      suggestedQuickReplies: quickReplies
    };
  }

  private async processWithGeminiLive(
    input: ProcessVoiceInput,
    state: VoiceAssistantSessionState
  ): Promise<VoiceAssistantResponse> {
    const userParts: any[] = [];

    if (input.audioBuffer) {
      userParts.push(
        GeminiClientService.audioBufferToGenerativePart(input.audioBuffer, input.audioMimeType || 'audio/wav')
      );
    }
    if (input.userText) {
      userParts.push({ text: input.userText });
    }

    const systemInstruction = `
You are the Vietnamese Voice & Chatbot Assistant for SME AutoPilot (#BuildwithGoogleAI AI Riser Vietnam 2026).
Adapt naturally to Vietnamese regional dialects (Northern: 'ạ, thế nào', Central: 'răng, rứa, mô, tê, hè', Southern: 'nhiêu, hông, nè, nghen, dạ').
Always respond politely with Vietnamese courtesy particles (Dạ, Vâng, ạ).
Call the appropriate function tool when the customer asks for inventory, shipping calculation, order creation, order tracking, or discount voucher.
    `;

    const contents = [
      ...state.history.map(h => ({
        role: (h.role === 'assistant' ? 'model' : 'user') as any,
        parts: [{ text: h.content }]
      })),
      { role: 'user' as const, parts: userParts }
    ];

    const geminiRes = await this.geminiClient.generateWithTools({
      model: 'gemini-2.0-flash',
      systemInstruction,
      contents,
      tools: [{ functionDeclarations: toolDeclarations as any }]
    });

    const executedToolCalls: Array<{ toolName: string; args: any; result: any }> = [];

    if (geminiRes.functionCalls && geminiRes.functionCalls.length > 0) {
      for (const fc of geminiRes.functionCalls) {
        const toolResult = await executeToolCall(fc.name, fc.args, { sessionId: input.sessionId, state });
        executedToolCalls.push({
          toolName: fc.name,
          args: fc.args,
          result: toolResult
        });
      }
    }

    const responseText = geminiRes.text || 'Dạ em đã ghi nhận thông tin của bạn ạ!';

    state.history.push({
      role: 'user',
      content: input.userText || '[Giọng nói]',
      timestamp: new Date().toISOString()
    });
    state.history.push({
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString()
    });
    this.sessions.set(input.sessionId, state);

    return {
      sessionId: input.sessionId,
      responseText,
      detectedDialect: state.detectedDialect,
      toolCallsExecuted: executedToolCalls,
      sessionState: state
    };
  }
}

// Global Singleton
let defaultVoiceAssistantService: VoiceAssistantService | null = null;

export function getVoiceAssistantService(): VoiceAssistantService {
  if (!defaultVoiceAssistantService) {
    defaultVoiceAssistantService = new VoiceAssistantService();
  }
  return defaultVoiceAssistantService;
}
