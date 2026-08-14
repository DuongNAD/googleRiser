/**
 * SME AutoPilot — Multimodal AI Routes
 * backend/src/routes/ai.routes.ts
 */

import { Router, Request, Response } from 'express';
import { getBillForensicsService } from '../ai/billForensics';
import { getProductStudioService } from '../ai/productStudio';
import { getVoiceAssistantService } from '../ai/voiceAssistant';
import { getGeminiClient } from '../ai/geminiClient';
import { ApiResponse, ProductTheme, CopyTone, RegionalDialect } from '../../../shared';

export const aiRouter = Router();

// ============================================================================
// 1. BILL FORENSICS & VIETQR VERIFICATION
// ============================================================================

const handleBillAudit = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      imageBase64,
      imageBuffer,
      receiptData,
      rawQrPayload,
      activeOrders,
      expectedAmount,
      expectedAccount,
      bankName
    } = req.body || {};

    const service = getBillForensicsService();

    const normalizedReceiptData = {
      ...(receiptData || {}),
      ...(expectedAmount !== undefined ? { amount: expectedAmount } : {}),
      ...(expectedAccount !== undefined ? { accountNumber: expectedAccount } : {}),
      ...(bankName ? { bankName } : {})
    };

    const auditInput = {
      imageBase64,
      imageBuffer: imageBuffer ? Buffer.from(imageBuffer) : undefined,
      receiptData: Object.keys(normalizedReceiptData).length > 0 ? normalizedReceiptData : undefined,
      rawQrPayload,
      activeOrders
    };

    const result = await service.auditReceipt(auditInput);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code || 'BILL_AUDIT_FAILED',
        message: error.message || 'Failed to analyze bill receipt'
      },
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
  }
};

aiRouter.post('/forensics/audit-bill', handleBillAudit);
aiRouter.post('/forensics/analyze', handleBillAudit);
aiRouter.post('/audit', handleBillAudit);

// ============================================================================
// 2. PRODUCT STUDIO & MULTI-CHANNEL COPYWRITING
// ============================================================================

const handleProductMarketing = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      productName,
      productTitle,
      title,
      rawDescription,
      imageBase64,
      imageUrl,
      industry,
      tone,
      stagingTheme,
      preferredTheme,
      preferredTone,
      brandName,
      targetPrice,
      merchantHints
    } = req.body || {};

    const effectiveTitle = productName || productTitle || title || merchantHints?.title;
    const effectiveDesc = rawDescription || merchantHints?.rawDescription;
    const effectiveTheme = (stagingTheme || preferredTheme || merchantHints?.preferredTheme) as ProductTheme;
    const effectiveTone = (tone || preferredTone || merchantHints?.preferredTone) as CopyTone;

    const service = getProductStudioService();

    const input = {
      imageBase64,
      imageUrl,
      merchantHints: {
        title: effectiveTitle,
        rawDescription: effectiveDesc,
        targetPrice: targetPrice || merchantHints?.targetPrice,
        brandName: brandName || merchantHints?.brandName || (industry ? `SME ${industry}` : undefined),
        preferredTheme: effectiveTheme,
        preferredTone: effectiveTone
      }
    };

    const result = await service.generateProductPack(input);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code || 'PRODUCT_MARKETING_FAILED',
        message: error.message || 'Failed to generate product marketing pack'
      },
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
  }
};

aiRouter.post('/product/generate-marketing', handleProductMarketing);
aiRouter.post('/product-studio/generate', handleProductMarketing);

// ============================================================================
// 3. VOICE ASSISTANT & CHAT
// ============================================================================

const handleVoiceChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      message,
      userText,
      dialectHint,
      sessionState
    } = req.body || {};

    const text = message !== undefined ? message : userText;
    const service = getVoiceAssistantService();

    const result = await service.processVoiceTurn({
      sessionId,
      userText: text,
      dialectHint: dialectHint as RegionalDialect,
      sessionState
    });

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code || 'VOICE_CHAT_FAILED',
        message: error.message || 'Failed to process voice chat turn'
      },
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
  }
};

aiRouter.post('/voice/chat', handleVoiceChat);
aiRouter.post('/voice-assistant/turn', handleVoiceChat);

// Audio Order Endpoint
aiRouter.post('/voice/audio-order', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      sessionId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      audioBase64,
      audioBuffer,
      mimeType = 'audio/webm',
      audioMimeType,
      dialectHint,
      sessionState
    } = req.body || {};

    if (!audioBase64 && !audioBuffer) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_AUDIO_PAYLOAD',
          message: 'Audio payload (audioBase64 or audioBuffer) is required'
        },
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }

    const buffer = audioBuffer
      ? Buffer.from(audioBuffer)
      : Buffer.from(audioBase64, 'base64');

    const service = getVoiceAssistantService();
    const result = await service.processVoiceTurn({
      sessionId,
      audioBuffer: buffer,
      audioMimeType: audioMimeType || mimeType,
      dialectHint: dialectHint as RegionalDialect,
      sessionState
    });

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code || 'AUDIO_ORDER_FAILED',
        message: error.message || 'Failed to process audio order'
      },
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
  }
});

// ============================================================================
// 4. SERVER-SENT EVENTS (SSE) STREAMING
// ============================================================================

aiRouter.get('/stream-generate', (req: Request, res: Response): void => {
  const prompt = (req.query.prompt as string) || 'Xin chào! Tôi có thể giúp gì cho shop của bạn hôm nay?';
  const type = (req.query.type as string) || 'general';

  // Set SSE HTTP Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  // Tokenize response into words/chunks
  const tokens = prompt.split(' ');
  let tokenIdx = 0;
  let isClosed = false;

  const intervalId = setInterval(() => {
    if (isClosed) {
      clearInterval(intervalId);
      return;
    }

    if (tokenIdx < tokens.length) {
      const chunkText = tokens[tokenIdx] + (tokenIdx < tokens.length - 1 ? ' ' : '');
      const eventData = JSON.stringify({ text: chunkText, index: tokenIdx });
      res.write(`event: token\ndata: ${eventData}\n\n`);
      tokenIdx++;
    } else {
      clearInterval(intervalId);
      const doneData = JSON.stringify({
        totalTokens: tokens.length,
        promptLength: prompt.length,
        type,
        completedAt: new Date().toISOString()
      });
      res.write(`event: done\ndata: ${doneData}\n\n`);
      res.end();
    }
  }, 25);

  // Heartbeat / keep-alive
  const heartbeatId = setInterval(() => {
    if (isClosed) {
      clearInterval(heartbeatId);
      return;
    }
    res.write(`: heartbeat\n\n`);
  }, 15000);

  // Clean up on client disconnect
  req.on('close', () => {
    isClosed = true;
    clearInterval(intervalId);
    clearInterval(heartbeatId);
  });
});
