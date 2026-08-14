import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains
} from '../harness';
import { VoiceAssistantTurn, VoiceToolCall, VoiceToolResult } from '../../shared';

export type VoiceState = 'IDLE' | 'RECORDING' | 'TRANSCRIBING' | 'PROCESSING_TOOLS' | 'SPEAKING';

export class VoiceAssistantUIController {
  private currentState: VoiceState = 'IDLE';
  private turns: VoiceAssistantTurn[] = [];
  private currentAudioBuffer: string | null = null;
  private isAudioPlaying: boolean = false;

  getState(): VoiceState {
    return this.currentState;
  }

  startRecording(): void {
    if (this.currentState !== 'IDLE') {
      throw new Error(`Cannot start recording from state ${this.currentState}`);
    }
    this.currentState = 'RECORDING';
  }

  stopRecording(base64Audio: string): void {
    if (this.currentState !== 'RECORDING') {
      throw new Error(`Cannot stop recording from state ${this.currentState}`);
    }
    this.currentAudioBuffer = base64Audio;
    this.currentState = 'TRANSCRIBING';
  }

  addUserMessage(content: string): void {
    this.turns.push({
      role: 'user',
      content,
      audioData: this.currentAudioBuffer || undefined,
      timestamp: new Date().toISOString()
    });
    this.currentAudioBuffer = null;
    this.currentState = 'PROCESSING_TOOLS';
  }

  addAssistantResponse(
    content: string,
    toolCalls?: VoiceToolCall[],
    toolResults?: VoiceToolResult[]
  ): void {
    this.turns.push({
      role: 'assistant',
      content,
      toolCalls,
      toolResults,
      timestamp: new Date().toISOString()
    });
    this.currentState = 'SPEAKING';
    this.isAudioPlaying = true;
  }

  finishSpeaking(): void {
    this.isAudioPlaying = false;
    this.currentState = 'IDLE';
  }

  getTurns(): VoiceAssistantTurn[] {
    return [...this.turns];
  }

  getIsAudioPlaying(): boolean {
    return this.isAudioPlaying;
  }
}

export function validateAudioBuffer(base64Data: string, sampleRateHz: number = 16000): {
  valid: boolean;
  sizeBytes: number;
  estimatedDurationSec: number;
} {
  if (!base64Data || typeof base64Data !== 'string') {
    return {
      valid: false,
      sizeBytes: 0,
      estimatedDurationSec: 0
    };
  }

  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (cleanBase64.length === 0) {
    return {
      valid: false,
      sizeBytes: 0,
      estimatedDurationSec: 0
    };
  }

  const paddingMatch = cleanBase64.match(/=+$/);
  const paddingCount = paddingMatch ? Math.min(paddingMatch[0].length, 2) : 0;
  const sizeBytes = Math.max(0, Math.floor((cleanBase64.length * 3) / 4) - paddingCount);
  // Assuming 16-bit mono PCM (2 bytes per sample)
  const bytesPerSample = 2;
  const samples = sizeBytes / bytesPerSample;
  const estimatedDurationSec = Math.round((samples / sampleRateHz) * 10) / 10;

  return {
    valid: sizeBytes >= 100,
    sizeBytes,
    estimatedDurationSec
  };
}

export function formatToolBadges(toolCalls: VoiceToolCall[], toolResults?: VoiceToolResult[]): {
  toolName: string;
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  summaryVi: string;
}[] {
  return toolCalls.map(tc => {
    const result = toolResults?.find(tr => tr.toolName === tc.name);
    let summaryVi = '';
    if (tc.name === 'query_inventory') {
      summaryVi = `Kiểm tra tồn kho: ${tc.args.skuOrName || 'sản phẩm'}`;
    } else if (tc.name === 'calculate_shipping_fee') {
      summaryVi = `Tính phí ship: ${tc.args.city || 'toàn quốc'}`;
    } else if (tc.name === 'create_draft_order') {
      summaryVi = `Tạo đơn hàng nháp: ${tc.args.customerName || 'khách hàng'}`;
    } else {
      summaryVi = `Gọi công cụ: ${tc.name}`;
    }

    return {
      toolName: tc.name,
      status: result ? (result.error ? 'FAILED' : 'EXECUTED') : 'PENDING',
      summaryVi
    };
  });
}

describe('F14: Voice Assistant & Chat Widget UI State', () => {
  test('Test 14.1: Audio buffer ingestion and duration estimation', () => {
    // 1 second of 16kHz 16-bit audio = 32,000 bytes
    const mockAudioBase64 = 'A'.repeat(42667);
    const audioValidation = validateAudioBuffer(mockAudioBase64, 16000);

    assertTrue(audioValidation.valid);
    assertTrue(audioValidation.sizeBytes >= 30000);
    assertEqual(audioValidation.estimatedDurationSec, 1.0);
  });

  test('Test 14.2: Mic recording state machine lifecycle', () => {
    const controller = new VoiceAssistantUIController();
    assertEqual(controller.getState(), 'IDLE');

    controller.startRecording();
    assertEqual(controller.getState(), 'RECORDING');

    controller.stopRecording('data:audio/wav;base64,UklGR...');
    assertEqual(controller.getState(), 'TRANSCRIBING');

    controller.addUserMessage('Kiểm tra áo dài đỏ còn size L không shop');
    assertEqual(controller.getState(), 'PROCESSING_TOOLS');

    controller.addAssistantResponse('Dạ áo dài lụa đỏ size L hiện còn 15 bộ trong kho ạ!');
    assertEqual(controller.getState(), 'SPEAKING');
    assertTrue(controller.getIsAudioPlaying());

    controller.finishSpeaking();
    assertEqual(controller.getState(), 'IDLE');
    assertFalse(controller.getIsAudioPlaying());
  });

  test('Test 14.3: Real-time conversational message stream formatting', () => {
    const controller = new VoiceAssistantUIController();
    controller.startRecording();
    controller.stopRecording('mock_audio');
    controller.addUserMessage('Tính tiền ship về Cầu Giấy');
    controller.addAssistantResponse('Dạ phí ship về Cầu Giấy là 25,000đ ạ!');

    const turns = controller.getTurns();
    assertEqual(turns.length, 2);
    assertEqual(turns[0].role, 'user');
    assertEqual(turns[0].content, 'Tính tiền ship về Cầu Giấy');
    assertEqual(turns[1].role, 'assistant');
    assertTrue(!!turns[1].timestamp);
  });

  test('Test 14.4: Function calling tool execution badge formatting', () => {
    const toolCalls: VoiceToolCall[] = [
      { name: 'query_inventory', args: { skuOrName: 'AD-01' } },
      { name: 'calculate_shipping_fee', args: { city: 'Hà Nội' } }
    ];
    const toolResults: VoiceToolResult[] = [
      { toolName: 'query_inventory', result: { stock: 10 } },
      { toolName: 'calculate_shipping_fee', result: { fee: 25000 } }
    ];

    const badges = formatToolBadges(toolCalls, toolResults);
    assertEqual(badges.length, 2);
    assertEqual(badges[0].status, 'EXECUTED');
    assertContains(badges[0].summaryVi, 'Kiểm tra tồn kho');
    assertEqual(badges[1].status, 'EXECUTED');
    assertContains(badges[1].summaryVi, 'Tính phí ship');
  });

  test('Test 14.5: Voice Assistant audio playback trigger and completion event', () => {
    const controller = new VoiceAssistantUIController();
    controller.startRecording();
    controller.stopRecording('audio');
    controller.addUserMessage('Tạo đơn hàng');
    controller.addAssistantResponse('Đã tạo đơn thành công!');

    assertTrue(controller.getIsAudioPlaying());
    controller.finishSpeaking();
    assertFalse(controller.getIsAudioPlaying());
  });
});
