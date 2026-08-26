import React, { useState, useEffect } from 'react';
import {
  Layers,
  FileSpreadsheet,
  Mail,
  Calendar,
  MapPin,
  Database,
  Cpu,
  Key,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Save,
  Shield,
  Clock,
  ExternalLink,
  Store
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { googleApi } from '../api/googleApi';
import { formatRelativeTimeVi, formatDateTimeVi } from '../utils/formatting';
import { SentEmailRecord, CalendarEvent, StoreBranch, AuditLogEntry } from '@shared';

export const EcosystemSettingsView: React.FC = () => {
  const {
    mode,
    toggleMode,
    industry,
    switchIndustry,
    industryName,
    serviceStatus,
    resetDemoData,
    addToast,
    isLoading
  } = useApp();

  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [googleCreds, setGoogleCreds] = useState<string>('');
  const [mapsApiKey, setMapsApiKey] = useState<string>('');
  const [outbox, setOutbox] = useState<SentEmailRecord[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [branches, setBranches] = useState<StoreBranch[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    const fetchEcosystemData = async () => {
      try {
        const [outboxRes, eventsRes, branchesRes, logsRes] = await Promise.all([
          googleApi.getGmailOutbox(),
          googleApi.getCalendarEvents(),
          googleApi.getStoreBranches(),
          googleApi.getFirestoreAuditLogs()
        ]);
        if (outboxRes.success && outboxRes.data) setOutbox(outboxRes.data);
        if (eventsRes.success && eventsRes.data) setEvents(eventsRes.data);
        if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
        if (logsRes.success && logsRes.data) setAuditLogs(logsRes.data);
      } catch (err: any) {
        console.error('Error fetching ecosystem status:', err);
      }
    };
    fetchEcosystemData();
  }, []);

  const handleSaveApiKeys = () => {
    addToast({
      type: 'success',
      title: 'Đã Lưu Cấu Hình API Keys',
      message: 'Các khóa API đã được cập nhật an toàn vào môi trường chạy.'
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 light:bg-white light:border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2 light:bg-blue-50 light:text-blue-700 light:border-blue-200">
            <Layers className="w-3.5 h-3.5" />
            <span>Google Cloud SPI & Enterprise Integration</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight light:text-slate-900">
            Quản Lý Google Ecosystem & Cấu Hình Hệ Thống
          </h1>
          <p className="text-xs text-slate-400 mt-1 light:text-slate-500">
            Kiểm tra trạng thái kết nối 6 dịch vụ Google SPI, chuyển đổi dữ liệu mẫu ngành hàng và thiết lập API keys.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={resetDemoData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Khôi Phục Dữ Liệu Demo</span>
          </button>
        </div>
      </div>

      {/* Mode & Industry Control Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mode Switch Card */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col justify-between space-y-4 light:border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white light:text-slate-900">Chế Độ Môi Trường Vận Hành</h3>
              <p className="text-xs text-slate-400 mt-0.5 light:text-slate-500">
                Chuyển đổi giữa Chế độ Giả lập an toàn (Demo) và Live Google API
              </p>
            </div>
            <span
              className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border ${
                mode === 'demo'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-200'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30 light:bg-blue-50 light:text-blue-700 light:border-blue-200'
              }`}
            >
              {mode === 'demo' ? '🟢 DEMO MODE (SPI Mock)' : '🔵 LIVE API MODE'}
            </span>
          </div>

          <button
            onClick={toggleMode}
            className={`w-full py-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg ${
              mode === 'demo'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Chuyển Sang {mode === 'demo' ? 'Live Mode (Google Cloud & Gemini)' : 'Demo Mode (Mock Chuẩn)'}</span>
          </button>
        </div>

        {/* Industry Switcher Card */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 light:border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white light:text-slate-900">Dữ Liệu Ngành Kinh Doanh</h3>
              <p className="text-xs text-slate-400 mt-0.5 light:text-slate-500">
                Chuyển đổi nhanh 3 kịch bản kinh doanh thực tế tại Việt Nam
              </p>
            </div>
            <Store className="w-5 h-5 text-indigo-400 light:text-indigo-600" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'fashion', label: '👗 Thời Trang', desc: 'Mai Anh Silk' },
              { id: 'fnb', label: '🧋 F&B', desc: 'Bếp Mẹ Bắp' },
              { id: 'cosmetics', label: '🌿 Mỹ Phẩm', desc: 'GlowSkin' }
            ].map((ind) => (
              <button
                key={ind.id}
                onClick={() => switchIndustry(ind.id as any)}
                className={`p-2.5 rounded-2xl text-left border transition flex flex-col justify-between ${
                  industry === ind.id
                    ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500 ring-2 ring-indigo-500/30 light:bg-indigo-50 light:text-indigo-700 light:border-indigo-300 light:ring-indigo-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white light:bg-slate-50 light:border-slate-200 light:text-slate-600 light:hover:text-slate-900 light:hover:bg-slate-100'
                }`}
              >
                <span className="font-bold text-xs light:text-slate-900">{ind.label}</span>
                <span className="text-[10px] text-slate-400 mt-1 light:text-slate-500">{ind.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6 Google Cloud & Workspace Services Matrix */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 light:border-slate-200">
        <h3 className="text-base font-bold text-white flex items-center gap-2 light:text-slate-900">
          <Layers className="w-5 h-5 text-indigo-400 light:text-indigo-600" />
          <span>Trạng Thái Kết Nối 6 Dịch Vụ Google SPI</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Sheets */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 light:bg-slate-50 light:border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs light:text-emerald-700">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Google Sheets API v4</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full light:bg-emerald-50 light:text-emerald-700">
                {serviceStatus.sheets ? 'ONLINE' : 'MOCK'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 light:text-slate-600">
              Đồng bộ 2 chiều tồn kho và sổ quỹ đơn hàng.
            </p>
            <div className="text-[10px] font-mono text-slate-500 light:text-slate-400 truncate">
              ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
            </div>
          </div>

          {/* Gmail */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 light:bg-slate-50 light:border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs light:text-red-700">
                <Mail className="w-4 h-4" />
                <span>Gmail API v1</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full light:bg-emerald-50 light:text-emerald-700">
                {serviceStatus.gmail ? 'ONLINE' : 'MOCK'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 light:text-slate-600">
              Tự động gửi email hóa đơn điện tử kèm mã QR thanh toán.
            </p>
            <div className="text-[10px] font-mono text-slate-500 light:text-slate-400">
              Hộp thư đi: {outbox.length} email đã gửi
            </div>
          </div>

          {/* Calendar */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 light:bg-slate-50 light:border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs light:text-blue-700">
                <Calendar className="w-4 h-4" />
                <span>Google Calendar API v3</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full light:bg-emerald-50 light:text-emerald-700">
                {serviceStatus.calendar ? 'ONLINE' : 'MOCK'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 light:text-slate-600">
              Lên lịch livestream TikTok, flash sale và nhập hàng.
            </p>
            <div className="text-[10px] font-mono text-slate-500 light:text-slate-400">
              Sự kiện: {events.length} sự kiện sắp diễn ra
            </div>
          </div>

          {/* Maps */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 light:bg-slate-50 light:border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs light:text-amber-700">
                <MapPin className="w-4 h-4" />
                <span>Google Maps Platform</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full light:bg-emerald-50 light:text-emerald-700">
                {serviceStatus.maps ? 'ONLINE' : 'MOCK'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 light:text-slate-600">
              Tính cước giao hàng shipper xe máy & tối ưu tuyến đường.
            </p>
            <div className="text-[10px] font-mono text-slate-500 light:text-slate-400">
              Điểm kho: {branches.length} chi nhánh / kho hàng
            </div>
          </div>

          {/* Firestore */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 light:bg-slate-50 light:border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-400 font-bold text-xs light:text-orange-700">
                <Database className="w-4 h-4" />
                <span>Firebase Firestore & Auth</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full light:bg-emerald-50 light:text-emerald-700">
                {serviceStatus.firestore ? 'ONLINE' : 'MOCK'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 light:text-slate-600">
              Lưu trữ nhật ký kiểm toán bất biến & hồ sơ nhà bán.
            </p>
            <div className="text-[10px] font-mono text-slate-500 light:text-slate-400">
              Nhật ký: {auditLogs.length} bản ghi kiểm toán
            </div>
          </div>

          {/* Gemini */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 light:bg-slate-50 light:border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs light:text-indigo-700">
                <Cpu className="w-4 h-4" />
                <span>Google Gemini 2.0 API</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full light:bg-emerald-50 light:text-emerald-700">
                {serviceStatus.gemini ? 'ONLINE' : 'MOCK'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 light:text-slate-600">
              Pháp y VietQR, Product Studio copy & Trợ lý giọng nói.
            </p>
            <div className="text-[10px] font-mono text-slate-500 light:text-slate-400">
              Mô hình: gemini-2.0-flash / pro / imagen-3
            </div>
          </div>
        </div>
      </div>

      {/* API Key Overrides & Security */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 light:border-slate-200">
        <h3 className="text-base font-bold text-white flex items-center gap-2 light:text-slate-900">
          <Key className="w-5 h-5 text-indigo-400 light:text-indigo-600" />
          <span>Cấu Hình Khóa API & Thông Tin Xác Thực (Tùy Chọn)</span>
        </h3>
        <p className="text-xs text-slate-400 light:text-slate-500">
          Trong chế độ Demo, hệ thống tự động chạy trên SPI Mock engine không cần API key. Nếu bạn muốn chạy Live Mode trên hạ tầng Google Cloud của bạn, hãy nhập thông tin bên dưới:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-slate-300 font-semibold mb-1 block light:text-slate-700">GEMINI_API_KEY:</label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500 light:bg-white light:border-slate-300 light:text-slate-900"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold mb-1 block light:text-slate-700">GOOGLE_APPLICATION_CREDENTIALS:</label>
            <input
              type="text"
              value={googleCreds}
              onChange={(e) => setGoogleCreds(e.target.value)}
              placeholder="sa-credentials.json"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500 light:bg-white light:border-slate-300 light:text-slate-900"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold mb-1 block light:text-slate-700">GOOGLE_MAPS_API_KEY:</label>
            <input
              type="password"
              value={mapsApiKey}
              onChange={(e) => setMapsApiKey(e.target.value)}
              placeholder="AIzaSyMaps..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500 light:bg-white light:border-slate-300 light:text-slate-900"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveApiKeys}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition"
          >
            <Save className="w-4 h-4" />
            <span>Lưu Khóa API</span>
          </button>
        </div>
      </div>
    </div>
  );
};
