/**
 * Milestone 1 Unit Tests: Gemini 2.0 Multimodal Client
 * backend/tests/ai/geminiClient.test.ts
 */

import { GeminiClientService, getGeminiClient } from '../../src/ai/geminiClient';

export function runGeminiClientTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message || String(err) });
    }
  }

  function assert(condition: boolean, msg?: string) {
    if (!condition) throw new Error(msg || 'Assertion failed');
  }

  function assertEqual(actual: any, expected: any, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  // 1. Initialization & Demo Mode
  test('GeminiClient: Initializes in demo mode when no API key is provided', () => {
    const client = new GeminiClientService();
    assert(client.isDemoMode(), 'Should default to demo mode');
    assertEqual(client.isLiveMode(), false, 'isLiveMode should be false');
  });

  test('GeminiClient: Singleton returns consistent client instance', () => {
    const c1 = getGeminiClient();
    const c2 = getGeminiClient();
    assert(c1 === c2, 'getGeminiClient should return singleton');
  });

  // 2. Structured JSON Parsing
  test('GeminiClient: cleanAndParseJson correctly strips markdown fences', () => {
    const client = new GeminiClientService();
    const raw = '```json\n{\n  "status": "success",\n  "count": 42\n}\n```';
    const parsed = client.cleanAndParseJson<{ status: string; count: number }>(raw);
    assertEqual(parsed.status, 'success');
    assertEqual(parsed.count, 42);
  });

  test('GeminiClient: cleanAndParseJson parses array responses', () => {
    const client = new GeminiClientService();
    const raw = '```\n["item1", "item2", "item3"]\n```';
    const parsed = client.cleanAndParseJson<string[]>(raw);
    assertEqual(parsed.length, 3);
    assertEqual(parsed[0], 'item1');
  });

  test('GeminiClient: cleanAndParseJson handles text with surrounding chatter', () => {
    const client = new GeminiClientService();
    const raw = 'Here is your JSON response:\n{"result": true, "score": 0.95}\nHope that helps!';
    const parsed = client.cleanAndParseJson<{ result: boolean; score: number }>(raw);
    assertEqual(parsed.result, true);
    assertEqual(parsed.score, 0.95);
  });

  // 3. Generative Parts Helpers
  test('GeminiClient: bufferToGenerativePart formats inline base64 data', () => {
    const buf = Buffer.from('test-image-data');
    const part = GeminiClientService.bufferToGenerativePart(buf, 'image/jpeg');
    assert(part.inlineData !== undefined);
    assertEqual(part.inlineData?.mimeType, 'image/jpeg');
    assertEqual(part.inlineData?.data, buf.toString('base64'));
  });

  test('GeminiClient: base64ToGenerativePart strips data URI scheme', () => {
    const base64WithUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    const part = GeminiClientService.base64ToGenerativePart(base64WithUri, 'image/png');
    assertEqual(part.inlineData?.data, 'iVBORw0KGgoAAAANSUhEUg==');
    assertEqual(part.inlineData?.mimeType, 'image/png');
  });

  test('GeminiClient: audioBufferToGenerativePart formats audio mime types', () => {
    const buf = Buffer.from('audio-data');
    const part = GeminiClientService.audioBufferToGenerativePart(buf, 'audio/wav');
    assertEqual(part.inlineData?.mimeType, 'audio/wav');
  });

  return results;
}
