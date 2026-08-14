/**
 * Milestone 1 Unit Tests: Vietnamese Multi-Dialect Voice Assistant
 * backend/tests/ai/voiceAssistant.test.ts
 */

import { VoiceAssistantService } from '../../src/ai/voiceAssistant';

export async function runVoiceAssistantTests(): Promise<{ name: string; passed: boolean; error?: string }[]> {
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

  const voiceService = new VoiceAssistantService();

  // 1. Regional Dialect Recognition
  await test('VoiceAssistant: Detects Central Vietnamese dialect (răng, rứa, mô, hè)', async () => {
    const res = await voiceService.processVoiceTurn({
      sessionId: 'sess-central-1',
      userText: 'Áo dài ni giá bao nhiêu rứa shop, có bớt không hè?'
    });

    assertEqual(res.detectedDialect, 'CENTRAL');
    assert(res.responseText.includes('rứa') || res.responseText.includes('hè') || res.responseText.includes('ạ'));
  });

  await test('VoiceAssistant: Detects Southern Vietnamese dialect (nhiêu, hông, nè, nghen, dạ)', async () => {
    const res = await voiceService.processVoiceTurn({
      sessionId: 'sess-southern-1',
      userText: 'Mẫu này nhiêu tiền dạ shop, có freeship hông nè?'
    });

    assertEqual(res.detectedDialect, 'SOUTHERN');
    assert(res.responseText.includes('nè') || res.responseText.includes('nghen') || res.responseText.includes('dạ'));
  });

  await test('VoiceAssistant: Detects Northern Vietnamese dialect', async () => {
    const res = await voiceService.processVoiceTurn({
      sessionId: 'sess-northern-1',
      userText: 'Mẫu áo dài này giá bao nhiêu tiền ạ, shop còn size M không?'
    });

    assertEqual(res.detectedDialect, 'NORTHERN');
    assert(res.responseText.includes('ạ'));
  });

  // 2. Tool Integration during Voice Interactivity
  await test('VoiceAssistant: Automatically triggers inventory query on product inquiries', async () => {
    const res = await voiceService.processVoiceTurn({
      sessionId: 'sess-tool-inv',
      userText: 'Shop còn áo dài cách tân không?'
    });

    assert(res.toolCallsExecuted.length > 0, 'Should execute inventory query tool');
    assertEqual(res.toolCallsExecuted[0].toolName, 'query_inventory');
    assert(res.responseText.includes('589.000đ') || res.responseText.includes('Áo Dài'));
  });

  await test('VoiceAssistant: Automatically triggers shipping calculation on delivery queries', async () => {
    const res = await voiceService.processVoiceTurn({
      sessionId: 'sess-tool-ship',
      userText: 'Phí ship về Hà Nội là bao nhiêu ạ?'
    });

    assert(res.toolCallsExecuted.length > 0, 'Should execute calculate_shipping_fee tool');
    assertEqual(res.toolCallsExecuted[0].toolName, 'calculate_shipping_fee');
    assert(res.responseText.includes('15.000đ') || res.responseText.includes('Hà Nội'));
  });

  await test('VoiceAssistant: Automatically applies discount voucher when requested', async () => {
    const res = await voiceService.processVoiceTurn({
      sessionId: 'sess-tool-voucher',
      userText: 'Áp mã TET2026 giùm mình với'
    });

    assert(res.toolCallsExecuted.length > 0, 'Should execute apply_discount_voucher tool');
    assertEqual(res.toolCallsExecuted[0].toolName, 'apply_discount_voucher');
    assert(res.responseText.includes('TET2026') || res.responseText.includes('50.000đ'));
  });

  // 3. Multi-Turn Session Memory
  await test('VoiceAssistant: Maintains conversational turn history across multi-turn sessions', async () => {
    const sessionId = 'sess-multiturn-history';

    // Turn 1
    await voiceService.processVoiceTurn({
      sessionId,
      userText: 'Chào shop, tư vấn giúp mình mẫu áo dài Tết'
    });

    // Turn 2
    const turn2 = await voiceService.processVoiceTurn({
      sessionId,
      userText: 'Phí ship về Đà Nẵng bao nhiêu?'
    });

    assertEqual(turn2.sessionState.history.length, 4); // 2 user turns + 2 assistant turns
    assertEqual(turn2.sessionState.history[0].content, 'Chào shop, tư vấn giúp mình mẫu áo dài Tết');
    assertEqual(turn2.sessionState.history[2].content, 'Phí ship về Đà Nẵng bao nhiêu?');
  });

  // 4. Quick Replies
  await test('VoiceAssistant: Returns suggested quick replies for frictionless mobile voice UI', async () => {
    const res = await voiceService.processVoiceTurn({
      sessionId: 'sess-quick-replies',
      userText: 'Xin chào'
    });

    assert(res.suggestedQuickReplies !== undefined);
    assert(res.suggestedQuickReplies && res.suggestedQuickReplies.length >= 3);
  });

  return results;
}
