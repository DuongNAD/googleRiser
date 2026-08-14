/**
 * SME AutoPilot — Core Gemini 2.0 Client & Multimodal AI Service
 * backend/src/ai/geminiClient.ts
 *
 * Implements Gemini 2.0 Flash (gemini-2.0-flash) and Gemini 2.0 Pro (gemini-2.0-pro-exp-02-05)
 * with multimodal support (images, audio), structured JSON parsing, and deterministic mock fallbacks.
 */

export interface GenerativePart {
  inlineData?: {
    data: string; // base64 string
    mimeType: string;
  };
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, any>;
  };
}

export interface ContentMessage {
  role: 'user' | 'model' | 'assistant' | 'system' | 'tool';
  parts: GenerativePart[];
}

export interface GenerateTextOptions {
  model?: 'gemini-2.0-flash' | 'gemini-2.0-pro-exp-02-05' | string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  mockFallback?: () => string;
}

export interface GenerateJsonOptions<T> {
  model?: 'gemini-2.0-flash' | 'gemini-2.0-pro-exp-02-05' | string;
  systemInstruction?: string;
  prompt: string | (string | GenerativePart)[];
  schema?: Record<string, any>;
  temperature?: number;
  maxOutputTokens?: number;
  mockFallback: () => T;
}

export interface GenerateWithToolsOptions {
  model?: 'gemini-2.0-flash' | 'gemini-2.0-pro-exp-02-05' | string;
  systemInstruction?: string;
  contents: ContentMessage[];
  tools?: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters: Record<string, any>;
    }>;
  }>;
  temperature?: number;
}

export interface GeminiResponse {
  text: string;
  functionCalls?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  candidates?: any[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GeminiClientService {
  private apiKey: string | null = null;
  private isDemo: boolean;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY || null;
    this.apiKey = key;
    this.isDemo = process.env.DEMO_MODE === 'true' || !key || key === 'mock-key' || key === 'demo-key';
  }

  public isLiveMode(): boolean {
    return !this.isDemo && !!this.apiKey;
  }

  public isDemoMode(): boolean {
    return this.isDemo;
  }

  public setApiKey(key: string): void {
    this.apiKey = key;
    this.isDemo = !key || key === 'mock-key' || key === 'demo-key';
  }

  public setDemoMode(demo: boolean): void {
    this.isDemo = demo;
  }

  /**
   * Generates text content via Gemini 2.0 Flash / Pro
   */
  public async generateText(
    prompt: string | (string | GenerativePart)[],
    options?: GenerateTextOptions
  ): Promise<string> {
    if (this.isDemoMode() || !this.apiKey) {
      return options?.mockFallback ? options.mockFallback() : 'SME AutoPilot Demo Response';
    }

    try {
      const model = options?.model || 'gemini-2.0-flash';
      const parts = this.normalizeParts(prompt);

      const requestBody: any = {
        contents: [
          {
            role: 'user',
            parts
          }
        ],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxOutputTokens ?? 2048,
          topP: options?.topP ?? 0.95
        }
      };

      if (options?.systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: options.systemInstruction }]
        };
      }

      const response = await this.callGeminiApi(model, requestBody);
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return text.trim();
    } catch (error) {
      console.warn('[GeminiClientService] Live API call failed, using mock fallback:', error);
      return options?.mockFallback ? options.mockFallback() : 'SME AutoPilot Demo Response';
    }
  }

  /**
   * Generates structured JSON output adhering to an enforced schema
   */
  public async generateJson<T>(options: GenerateJsonOptions<T>): Promise<T> {
    if (this.isDemoMode() || !this.apiKey) {
      return options.mockFallback();
    }

    try {
      const model = options.model || 'gemini-2.0-flash';
      const parts = this.normalizeParts(options.prompt);

      const requestBody: any = {
        contents: [
          {
            role: 'user',
            parts
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.maxOutputTokens ?? 4096
        }
      };

      if (options.schema) {
        requestBody.generationConfig.responseSchema = options.schema;
      }

      if (options.systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: options.systemInstruction }]
        };
      }

      const response = await this.callGeminiApi(model, requestBody);
      const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return this.cleanAndParseJson<T>(rawText);
    } catch (error) {
      console.warn('[GeminiClientService] generateJson failed, using mock fallback:', error);
      return options.mockFallback();
    }
  }

  /**
   * Multi-turn chat and function calling generation
   */
  public async generateWithTools(options: GenerateWithToolsOptions): Promise<GeminiResponse> {
    if (this.isDemoMode() || !this.apiKey) {
      return {
        text: 'SME AutoPilot Tool Execution (Mock Mode)',
        functionCalls: []
      };
    }

    try {
      const model = options.model || 'gemini-2.0-flash';
      const formattedContents = options.contents.map(c => ({
        role: c.role === 'assistant' ? 'model' : c.role,
        parts: c.parts
      }));

      const requestBody: any = {
        contents: formattedContents,
        generationConfig: {
          temperature: options.temperature ?? 0.3
        }
      };

      if (options.systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: options.systemInstruction }]
        };
      }

      if (options.tools && options.tools.length > 0) {
        requestBody.tools = options.tools;
      }

      const response = await this.callGeminiApi(model, requestBody);
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let text = '';
      const functionCalls: Array<{ name: string; args: any }> = [];

      for (const part of parts) {
        if (part.text) {
          text += part.text;
        }
        if (part.functionCall) {
          functionCalls.push({
            name: part.functionCall.name,
            args: part.functionCall.args || {}
          });
        }
      }

      return {
        text: text.trim(),
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        candidates: response.candidates,
        usageMetadata: response.usageMetadata
      };
    } catch (error) {
      console.warn('[GeminiClientService] generateWithTools failed:', error);
      return {
        text: 'Live Gemini generation encountered an issue, fallback active.',
        functionCalls: []
      };
    }
  }

  /**
   * Robust JSON extractor that removes markdown blocks, whitespace, and isolates JSON tokens
   */
  public cleanAndParseJson<T>(rawText: string): T {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Invalid JSON text received');
    }

    let cleaned = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
    } else if (firstBracket !== -1) {
      const lastBracket = cleaned.lastIndexOf(']');
      if (lastBracket !== -1) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1);
      }
    }

    return JSON.parse(cleaned) as T;
  }

  /**
   * Helper to convert Buffer to Gemini Multimodal GenerativePart
   */
  public static bufferToGenerativePart(buffer: Buffer, mimeType: string): GenerativePart {
    return {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType
      }
    };
  }

  /**
   * Helper to convert Base64 string to Gemini GenerativePart
   */
  public static base64ToGenerativePart(base64: string, mimeType = 'image/jpeg'): GenerativePart {
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
    return {
      inlineData: {
        data: cleanBase64,
        mimeType
      }
    };
  }

  /**
   * Helper to convert Audio Buffer to Gemini Audio GenerativePart
   */
  public static audioBufferToGenerativePart(buffer: Buffer, mimeType = 'audio/wav'): GenerativePart {
    return {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType
      }
    };
  }

  /**
   * Helper to format text part
   */
  public static textPart(text: string): GenerativePart {
    return { text };
  }

  private normalizeParts(input: string | (string | GenerativePart)[]): GenerativePart[] {
    if (typeof input === 'string') {
      return [{ text: input }];
    }
    return input.map(item => {
      if (typeof item === 'string') {
        return { text: item };
      }
      return item;
    });
  }

  private async callGeminiApi(model: string, requestBody: any): Promise<any> {
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status} ${response.statusText}): ${errorText}`);
    }

    return await response.json();
  }
}

// Global Singleton Instance
let defaultClient: GeminiClientService | null = null;

export function getGeminiClient(apiKey?: string): GeminiClientService {
  if (!defaultClient || apiKey) {
    defaultClient = new GeminiClientService(apiKey);
  }
  return defaultClient;
}
