import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  runAllRegisteredSuites
} from '../harness';

export interface VoiceWidgetState {
  status: 'IDLE' | 'LISTENING' | 'PROCESSING' | 'PLAYING_AUDIO' | 'PERMISSION_DENIED' | 'ERROR';
  recordingDurationSeconds: number;
  maxRecordingSeconds: number;
  textInputFallbackVisible: boolean;
  transcript: string;
  errorMessage?: string;
  ttsAudioAvailable: boolean;
  lastAssistantText: string;
}

export class MockVoiceWidgetStateMachine {
  public state: VoiceWidgetState = {
    status: 'IDLE',
    recordingDurationSeconds: 0,
    maxRecordingSeconds: 60,
    textInputFallbackVisible: false,
    transcript: '',
    ttsAudioAvailable: false,
    lastAssistantText: ''
  };

  // Boundary 1: Mic permission denial
  public handlePermissionDenied(errorType: 'NotAllowedError' | 'PermissionDenied'): void {
    this.state.status = 'PERMISSION_DENIED';
    this.state.textInputFallbackVisible = true;
    this.state.errorMessage = 'Trình duyệt chưa được cấp quyền micro. Bạn có thể nhập tin nhắn văn bản bên dưới.';
  }

  // Boundary 2: 60-second audio timeout
  public tickRecordingSecond(secondsElapsed: number): { autoStopped: boolean; warning?: string } {
    this.state.recordingDurationSeconds = secondsElapsed;
    if (secondsElapsed >= this.state.maxRecordingSeconds) {
      this.state.status = 'PROCESSING';
      return {
        autoStopped: true,
        warning: 'Thời lượng ghi âm đã đạt giới hạn tối đa 60 giây. Đang xử lý đoạn âm thanh đã thu.'
      };
    }
    return { autoStopped: false };
  }

  // Boundary 3: Network drop during tool call execution
  public handleToolCallNetworkDrop(toolName: string): { toolStatus: 'FAILED'; userMessage: string } {
    this.state.status = 'IDLE';
    const userMessage = `Kết nối mạng bị gián đoạn khi thực hiện thao tác "${toolName}". Vui lòng thử lại.`;
    this.state.lastAssistantText = userMessage;
    return {
      toolStatus: 'FAILED',
      userMessage
    };
  }

  // Boundary 4: Audio playback failure (TTS audio play error)
  public handleAudioPlaybackFailure(audioError: Error): { textFallbackShown: boolean } {
    // Graceful degradation: don't crash, display text
    this.state.status = 'IDLE';
    this.state.ttsAudioAvailable = false;
    return { textFallbackShown: true };
  }

  // Boundary 5: Empty speech transcript / silence handler
  public handleSpeechRecognitionResult(transcript: string): string {
    if (!transcript || transcript.trim() === '') {
      this.state.status = 'IDLE';
      const promptText = 'Tôi chưa nghe rõ, bạn có thể nói lại được không?';
      this.state.lastAssistantText = promptText;
      return promptText;
    }
    this.state.transcript = transcript.trim();
    this.state.status = 'PROCESSING';
    return transcript.trim();
  }
}

describe('Tier 2 Feature B14: Voice Widget Edges Boundary Tests', () => {
  test('B14.1 - Mic permission denial transitions widget to PERMISSION_DENIED and reveals text input fallback', () => {
    const widget = new MockVoiceWidgetStateMachine();

    widget.handlePermissionDenied('NotAllowedError');

    assertEqual(widget.state.status, 'PERMISSION_DENIED');
    assertTrue(widget.state.textInputFallbackVisible);
    assertContains(widget.state.errorMessage!, 'chưa được cấp quyền micro');
  });

  test('B14.2 - 60-second audio stream timeout auto-stops recording and processes captured audio', () => {
    const widget = new MockVoiceWidgetStateMachine();
    widget.state.status = 'LISTENING';

    const tick59 = widget.tickRecordingSecond(59);
    assertFalse(tick59.autoStopped);
    assertEqual(widget.state.status, 'LISTENING');

    const tick60 = widget.tickRecordingSecond(60);
    assertTrue(tick60.autoStopped);
    assertEqual(widget.state.status, 'PROCESSING');
    assertContains(tick60.warning!, 'giới hạn tối đa 60 giây');
  });

  test('B14.3 - Network drop during tool call execution returns FAILED status with conversational message', () => {
    const widget = new MockVoiceWidgetStateMachine();

    const result = widget.handleToolCallNetworkDrop('query_inventory');

    assertEqual(result.toolStatus, 'FAILED');
    assertContains(result.userMessage, 'Kết nối mạng bị gián đoạn');
    assertContains(widget.state.lastAssistantText, 'query_inventory');
  });

  test('B14.4 - Audio playback failure gracefully falls back to text-only display without crash', () => {
    const widget = new MockVoiceWidgetStateMachine();
    widget.state.lastAssistantText = 'Dạ đơn hàng đã tạo thành công!';

    const fallbackResult = widget.handleAudioPlaybackFailure(new Error('AudioContext blocked by browser autoplay policy'));

    assertTrue(fallbackResult.textFallbackShown);
    assertEqual(widget.state.status, 'IDLE');
    assertFalse(widget.state.ttsAudioAvailable);
  });

  test('B14.5 - Empty speech transcript / silent recording triggers friendly prompt to speak again', () => {
    const widget = new MockVoiceWidgetStateMachine();

    const responseEmpty = widget.handleSpeechRecognitionResult('');
    assertEqual(responseEmpty, 'Tôi chưa nghe rõ, bạn có thể nói lại được không?');

    const responseSpaces = widget.handleSpeechRecognitionResult('    ');
    assertEqual(responseSpaces, 'Tôi chưa nghe rõ, bạn có thể nói lại được không?');
  });
});

if (require.main === module) {
  runAllRegisteredSuites().then(results => {
    let failed = 0;
    for (const r of results) {
      console.log(`Suite: ${r.name} (${r.passed}/${r.total} passed)`);
      failed += r.failed;
    }
    process.exit(failed > 0 ? 1 : 0);
  });
}
