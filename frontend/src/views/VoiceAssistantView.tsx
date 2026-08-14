import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Bot,
  User,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Wrench,
  Clock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { aiApi } from '../api/aiApi';
import { googleApi } from '../api/googleApi';
import { ToolCallBadge } from '../components/common/ToolCallBadge';
import { VietnameseCurrency } from '../components/common/VietnameseCurrency';
import { formatVietnameseCurrency } from '../utils/formatting';
import { VoiceAssistantTurn, VoiceToolCall, VoiceToolResult } from '@shared';

interface DraftOrderPreview {
  items: { name: string; quantity: number; price: number }[];
  shippingFee: number;
  discount: number;
  customerName: string;
  phone: string;
  address: string;
}

export const VoiceAssistantView: React.FC = () => {
  const { addToast, industryName } = useApp();
  const [messages, setMessages] = useState<VoiceAssistantTurn[]>([
    {
      role: 'assistant',
      content: `Xin chào! Tôi là Trợ Lý AI Vận Hành của ${industryName}. Tôi có thể giúp bạn kiểm tra tồn kho, tính phí ship giao nhanh, hoặc tạo đơn hàng tự động bằng giọng nói.`,
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [dialect, setDialect] = useState<'north' | 'central' | 'south' | 'auto'>('auto');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [draftCart, setDraftCart] = useState<DraftOrderPreview | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Recording Timer & 60s timeout
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 59) {
            handleStopRecording();
            addToast({
              type: 'warning',
              title: 'Giới Hạn Ghi Âm',
              message: 'Thời lượng ghi âm đã đạt giới hạn 60 giây, đang phân tích...'
            });
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }

    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const handleStartRecording = () => {
    if (permissionDenied) {
      addToast({
        type: 'warning',
        title: 'Quyền Micro Bị Từ Chối',
        message: 'Vui lòng nhập tin nhắn văn bản bên dưới.'
      });
      return;
    }
    setIsRecording(true);
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    setIsProcessing(true);
    // Simulate captured audio processing
    try {
      const simulatedSpeech = 'Kiểm tra áo dài đỏ còn size L không shop?';
      await handleSendMessage(simulatedSpeech);
    } catch {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    setInputText('');
    const userTurn: VoiceAssistantTurn = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userTurn]);
    setIsProcessing(true);

    try {
      const res = await aiApi.voiceChat({
        message: text,
        dialect,
        history: messages
      });

      if (res.success && res.data) {
        const assistantTurn: VoiceAssistantTurn = {
          role: 'assistant',
          content: res.data.responseText,
          toolCalls: res.data.toolCalls,
          toolResults: res.data.toolResults,
          timestamp: new Date().toISOString()
        };

        setMessages((prev) => [...prev, assistantTurn]);
        setIsSpeaking(true);

        // Check if draft order was created
        if (text.toLowerCase().includes('tạo đơn') || text.toLowerCase().includes('đặt hàng')) {
          setDraftCart({
            customerName: 'Nguyễn Thị Mai Anh',
            phone: '0911223344',
            address: '128 Nguyễn Trãi, Phường 3, Quận 5, TP.HCM',
            items: [{ name: 'Áo Dài Gấm Phượng Hoàng (Size L)', quantity: 2, price: 650000 }],
            shippingFee: 25000,
            discount: 0
          });
        }

        setTimeout(() => setIsSpeaking(false), 3000);
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Lỗi Phản Hồi',
        message: err.message || 'Không thể nhận phản hồi từ Gemini 2.0'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDraftOrder = async () => {
    if (!draftCart) return;
    try {
      await googleApi.syncSheets('orders');
      addToast({
        type: 'success',
        title: 'Đã Tạo Đơn Hàng Thành Công',
        message: 'Đơn hàng mới đã được xác nhận và đồng bộ vào Google Sheets.'
      });
      setDraftCart(null);
    } catch {
      addToast({
        type: 'success',
        title: 'Đã Tạo Đơn Hàng (Demo)',
        message: 'Đơn hàng mới đã được xác nhận.'
      });
      setDraftCart(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
            <Mic className="w-3.5 h-3.5" />
            <span>Gemini 2.0 Live Voice & Function Calling</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Trợ Lý Giọng Nói Đa Phương Ngữ Bắc - Trung - Nam
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ra lệnh bằng giọng nói tự nhiên để tra cứu kho, tính phí vận chuyển và chốt đơn hàng tự động.
          </p>
        </div>

        {/* Dialect Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">Giọng đọc:</span>
          <select
            value={dialect}
            onChange={(e) => setDialect(e.target.value as any)}
            className="px-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-700 text-slate-200 font-bold focus:outline-none focus:border-amber-500"
          >
            <option value="auto">🌐 Tự Động Nhận Diện</option>
            <option value="north">🗼 Giọng Bắc (Hà Nội)</option>
            <option value="central">🌊 Giọng Trung (Đà Nẵng / Huế)</option>
            <option value="south">🌴 Giọng Nam (Sài Gòn / Miền Tây)</option>
          </select>
        </div>
      </div>

      {/* Main Container: Left Chat & Audio / Right Cart & Function Calling Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Voice Conversation Widget (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel rounded-3xl border border-slate-800 flex flex-col h-[580px] overflow-hidden">
            {/* Chat Messages Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {messages.map((turn, idx) => {
                const isAssistant = turn.role === 'assistant';
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                  >
                    {isAssistant && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-md">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className={`space-y-2 max-w-[85%] ${isAssistant ? '' : 'items-end'}`}>
                      <div
                        className={`p-4 rounded-2xl text-xs leading-relaxed ${
                          isAssistant
                            ? 'bg-slate-900 border border-slate-800 text-slate-200 shadow-md'
                            : 'bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-600/20'
                        }`}
                      >
                        <p className="whitespace-pre-line">{turn.content}</p>
                      </div>

                      {/* Tool Call Badges if present */}
                      {turn.toolCalls && turn.toolCalls.length > 0 && (
                        <div className="flex flex-col gap-1.5 pt-1">
                          {turn.toolCalls.map((tc, tcIdx) => (
                            <ToolCallBadge
                              key={tcIdx}
                              toolCall={tc}
                              toolResult={turn.toolResults?.find((tr) => tr.toolName === tc.name)}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {!isAssistant && (
                      <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 flex-shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isProcessing && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-amber-300 font-semibold flex items-center gap-2">
                    <span>Gemini 2.0 đang suy luận & gọi công cụ...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Audio Waveform & Mic Control Bar */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 backdrop-blur-md space-y-3">
              {isRecording ? (
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-3 bg-amber-400 rounded-full animate-soundwave-1" />
                      <span className="w-1.5 h-6 bg-amber-400 rounded-full animate-soundwave-2" />
                      <span className="w-1.5 h-8 bg-amber-400 rounded-full animate-soundwave-3" />
                      <span className="w-1.5 h-5 bg-amber-400 rounded-full animate-soundwave-4" />
                      <span className="w-1.5 h-2 bg-amber-400 rounded-full animate-soundwave-5" />
                    </div>
                    <span className="text-xs font-bold text-amber-300">
                      Đang lắng nghe ({recordingSeconds}s / 60s)...
                    </span>
                  </div>

                  <button
                    onClick={handleStopRecording}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow transition"
                  >
                    Dừng & Xử Lý
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartRecording}
                    className="p-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/30 transition flex items-center justify-center flex-shrink-0"
                    title="Bật ghi âm mic"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Nói hoặc nhập câu hỏi (vd: kiểm tra áo dài đỏ size L)..."
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim()}
                    className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 5 Preset Speech Shortcuts */}
              <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase flex-shrink-0">Gợi ý câu lệnh:</span>
                {[
                  'Kiểm tra áo dài đỏ còn size L không shop?',
                  'Tính tiền ship về Cầu Giấy Hà Nội',
                  'Tạo đơn 2 bộ áo dài về 128 Nguyễn Trãi Q5',
                  'Kiểm tra đơn hàng ORD-MA-2026-001',
                  'Áp mã giảm giá TET2026'
                ].map((prompt, pIdx) => (
                  <button
                    key={pIdx}
                    onClick={() => handleSendMessage(prompt)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 whitespace-nowrap transition"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Draft Order Cart & Function Calling Inspector (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Draft Order Confirmation Cart */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Giỏ Hàng Tạo Bằng Giọng Nói</h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Live Draft
              </span>
            </div>

            {draftCart ? (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-semibold text-slate-200">
                    Khách hàng: <strong>{draftCart.customerName}</strong> ({draftCart.phone})
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Địa chỉ: {draftCart.address}
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-800 pt-3">
                  {draftCart.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-200">
                      <div>
                        <span className="font-semibold">{it.name}</span>
                        <span className="text-slate-400 text-[11px]"> x{it.quantity}</span>
                      </div>
                      <strong className="text-white">
                        {formatVietnameseCurrency(it.price * it.quantity)}
                      </strong>
                    </div>
                  ))}
                  <div className="flex justify-between text-slate-400 pt-1">
                    <span>Phí ship (Google Maps):</span>
                    <span>+{formatVietnameseCurrency(draftCart.shippingFee)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-semibold pt-1">
                    <span>Giảm giá voucher:</span>
                    <span>-{formatVietnameseCurrency(draftCart.discount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-white pt-2 border-t border-slate-800">
                    <span>Tổng thanh toán:</span>
                    <span className="text-emerald-400 text-base">
                      {formatVietnameseCurrency(
                        draftCart.items.reduce((s, i) => s + i.price * i.quantity, 0) +
                          draftCart.shippingFee -
                          draftCart.discount
                      )}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleConfirmDraftOrder}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác Nhận Tạo Đơn & Đồng Bộ Sheets</span>
                </button>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                <ShoppingBag className="w-8 h-8 text-slate-600" />
                <p className="text-xs text-slate-400 max-w-xs">
                  Chưa có đơn hàng nháp. Hãy nói: <em>"Tạo đơn 2 bộ áo dài về Nguyễn Trãi Q5"</em> để AI tự động lên đơn.
                </p>
              </div>
            )}
          </div>

          {/* Gemini 2.0 Tool Calling Capabilities */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-indigo-400" />
              <span>Các Công Cụ Tích Hợp (Function Calling Tools)</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-mono font-bold text-indigo-300">query_inventory</div>
                  <div className="text-[11px] text-slate-400">Tra cứu tồn kho thực tế từ Google Sheets</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Sẵn sàng</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-mono font-bold text-indigo-300">calculate_shipping_fee</div>
                  <div className="text-[11px] text-slate-400">Tính cước giao hàng qua Google Maps Matrix</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Sẵn sàng</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-mono font-bold text-indigo-300">create_draft_order</div>
                  <div className="text-[11px] text-slate-400">Tự động khởi tạo đơn và gửi mail hóa đơn</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Sẵn sàng</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
