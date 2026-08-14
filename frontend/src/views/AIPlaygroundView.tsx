import React, { useState } from 'react';
import {
  Cpu,
  Play,
  Sliders,
  Code2,
  FileCode,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Terminal,
  Paperclip,
  Activity
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { aiApi } from '../api/aiApi';
import { Dropzone } from '../components/common/Dropzone';
import { validatePlaygroundConfig, PromptPlaygroundConfig } from '../utils/validators';

const SYSTEM_PRESETS = [
  {
    name: 'Pháp Y VietQR Chống Giả (Forensics)',
    model: 'gemini-2.0-flash',
    temp: 0.2,
    topP: 0.9,
    tokens: 2048,
    instruction: `Bạn là Chuyên viên Pháp Y Số cao cấp của Hệ thống SME AutoPilot Vietnam. Nhiệm vụ của bạn là kiểm tra tính xác thực của hóa đơn chuyển khoản ngân hàng (VietQR / NAPAS / 25+ Bank). Phân tích kỹ viền nén JPEG (ELA), phông chữ, nghịch lý thời gian và bóc tách dữ liệu có cấu trúc JSON.`
  },
  {
    name: 'Tư Vấn Bán Hàng & Chốt Đơn (Sales Agent)',
    model: 'gemini-2.0-flash',
    temp: 0.7,
    topP: 0.95,
    tokens: 2048,
    instruction: `Bạn là Nhân viên Chăm sóc Khách hàng thông minh, thân thiện của cửa hàng trực tuyến Việt Nam. Sử dụng công cụ query_inventory để kiểm tra tồn kho và calculate_shipping_fee để tính cước phí chính xác trước khi tư vấn.`
  },
  {
    name: 'Sáng Tạo Nội Dung Đa Kênh (Copywriter)',
    model: 'gemini-2.0-pro-exp',
    temp: 0.9,
    topP: 0.95,
    tokens: 4096,
    instruction: `Bạn là Chuyên gia Marketing & Copywriting E-commerce hàng đầu cho thị trường Việt Nam. Tạo nội dung hấp dẫn cho Facebook, kịch bản video TikTok 3 giây hook và tiêu đề chuẩn SEO Shopee.`
  }
];

export const AIPlaygroundView: React.FC = () => {
  const { addToast } = useApp();
  const [model, setModel] = useState<'gemini-2.0-flash' | 'gemini-2.0-pro-exp' | 'imagen-3.0-generate-002'>('gemini-2.0-flash');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.95);
  const [maxTokens, setMaxTokens] = useState<number>(2048);
  const [systemInstruction, setSystemInstruction] = useState<string>(SYSTEM_PRESETS[0].instruction);
  const [userPrompt, setUserPrompt] = useState<string>('Kiểm tra hóa đơn chuyển khoản Vietcombank 650.000đ và xuất kết quả theo schema JSON chuẩn.');
  const [streamOutput, setStreamOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [enableTools, setEnableTools] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const applyPreset = (preset: typeof SYSTEM_PRESETS[0]) => {
    setModel(preset.model as any);
    setTemperature(preset.temp);
    setTopP(preset.topP);
    setMaxTokens(preset.tokens);
    setSystemInstruction(preset.instruction);
    addToast({
      type: 'info',
      title: 'Đã Nạp Mẫu System Prompt',
      message: preset.name
    });
  };

  const handleExecutePrompt = async () => {
    const config: PromptPlaygroundConfig = {
      model,
      temperature,
      topP,
      maxOutputTokens: maxTokens,
      systemInstruction
    };

    const validation = validatePlaygroundConfig(config);
    if (!validation.valid) {
      addToast({
        type: 'error',
        title: 'Cấu Hình Không Hợp Lệ',
        message: validation.error || 'Vui lòng kiểm tra lại tham số'
      });
      return;
    }

    setIsExecuting(true);
    setStreamOutput('');
    const startTime = Date.now();

    // Subscribe to SSE stream or generate response
    const unsubscribe = aiApi.subscribeStreamGenerate(
      userPrompt,
      model,
      (chunk) => {
        setStreamOutput((prev) => prev + chunk);
        setTokenCount((prev) => prev + Math.max(1, Math.floor(chunk.length / 4)));
      },
      () => {
        setIsExecuting(false);
        setLatencyMs(Date.now() - startTime);
        addToast({
          type: 'success',
          title: 'Hoàn Tất Thực Thi',
          message: `Thời gian phản hồi: ${Date.now() - startTime}ms`
        });
      },
      (err) => {
        setIsExecuting(false);
        setLatencyMs(Date.now() - startTime);
      }
    );
  };

  const copyResult = () => {
    navigator.clipboard.writeText(streamOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>Google AI Studio & Gemini 2.0 Developer Workbench</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            AI Studio Playground — Thử Nghiệm Prompt & Schema Trực Tiếp
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tùy chỉnh nhiệt độ, Top-P, System Instructions và kiểm tra Structured Output JSON dành riêng cho giám khảo và lập trình viên.
          </p>
        </div>

        <button
          onClick={handleExecutePrompt}
          disabled={isExecuting || !userPrompt.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
        >
          <Play className={`w-4 h-4 ${isExecuting ? 'animate-spin' : ''}`} />
          <span>{isExecuting ? 'Đang Chạy Model...' : 'Chạy Thực Thi Prompt'}</span>
        </button>
      </div>

      {/* Preset System Templates */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Nạp Mẫu Cấu Hình Prompt SME Chuẩn:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SYSTEM_PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(p)}
              className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 text-left transition flex items-center justify-between"
            >
              <div>
                <h4 className="font-bold text-xs text-white">{p.name}</h4>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {p.model} • Temp: {p.temp}
                </p>
              </div>
              <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Parameters Sidebar & Prompt Editor / Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Model & Parameters Configuration (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Tham Số Mô Hình (Parameters)</span>
            </h3>

            {/* Model Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Chọn Mô Hình AI:</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
              >
                <option value="gemini-2.0-flash">gemini-2.0-flash (Siêu nhanh & Forensics)</option>
                <option value="gemini-2.0-pro-exp">gemini-2.0-pro-exp (Suy luận sâu)</option>
                <option value="imagen-3.0-generate-002">imagen-3.0-generate-002 (Visual Studio)</option>
              </select>
            </div>

            {/* Temperature Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-semibold">Temperature:</span>
                <span className="font-mono font-bold text-indigo-400">{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0.0 (Chính xác / Pháp y)</span>
                <span>2.0 (Sáng tạo)</span>
              </div>
            </div>

            {/* Top-P Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-semibold">Top-P (Nucleus Sampling):</span>
                <span className="font-mono font-bold text-indigo-400">{topP.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Max Output Tokens */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-semibold">Max Output Tokens:</span>
                <span className="font-mono font-bold text-indigo-400">{maxTokens}</span>
              </div>
              <input
                type="range"
                min="256"
                max="8192"
                step="256"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Function Calling Tools Toggle */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-300">
                <span>Bật Function Calling Tools</span>
                <input
                  type="checkbox"
                  checked={enableTools}
                  onChange={(e) => setEnableTools(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer w-4 h-4"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Prompt & Stream Inspector (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* System Instructions & User Prompt Editor */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span>System Instruction (Chỉ dẫn hệ thống):</span>
              </label>
              <textarea
                rows={3}
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span>User Prompt (Nội dung yêu cầu thử nghiệm):</span>
              </label>
              <textarea
                rows={3}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Multimodal Attachment */}
            <Dropzone
              onFileSelect={(file, base64) => setAttachedImage(base64)}
              previewUrl={attachedImage}
              onClear={() => setAttachedImage(null)}
              title="Đính kèm ảnh hóa đơn hoặc ảnh sản phẩm (Multimodal Vision)"
              subtitle="Hỗ trợ phân tích ảnh trực tiếp qua Gemini 2.0 Flash Vision"
            />
          </div>

          {/* Real-time Streaming Output & Telemetry */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Phản Hồi Trực Tiếp (SSE Real-time Token Stream)
                </h4>
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                {latencyMs !== null && (
                  <span className="text-emerald-400 font-mono font-bold">
                    ⚡ {latencyMs}ms
                  </span>
                )}
                {tokenCount > 0 && (
                  <span className="text-indigo-300 font-mono">
                    {tokenCount} tokens
                  </span>
                )}
                {streamOutput && (
                  <button
                    onClick={copyResult}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Đã Chép' : 'Sao Chép'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 min-h-[180px] max-h-[360px] overflow-y-auto text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
              {streamOutput || (
                <span className="text-slate-600">
                  // Kết quả phản hồi streaming từ Gemini 2.0 sẽ hiển thị tại đây khi bạn nhấn "Chạy Thực Thi Prompt"...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
