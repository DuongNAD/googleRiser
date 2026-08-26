import React from 'react';
import {
  X,
  Layers,
  FileSpreadsheet,
  Mail,
  Calendar,
  MapPin,
  Database,
  Cpu,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Zap
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const EcosystemDrawer: React.FC = () => {
  const { isDrawerOpen, setDrawerOpen, serviceStatus, mode, toggleMode, resetDemoData, isLoading } = useApp();

  if (!isDrawerOpen) return null;

  const services = [
    {
      id: 'gemini',
      name: 'Google Gemini 2.0 Flash / Pro',
      desc: 'Multimodal AI Forensics, Copywriting & Voice Agent',
      icon: Cpu,
      color: 'text-indigo-400',
      active: serviceStatus.gemini,
      meta: 'v2.0-flash / imagen-3'
    },
    {
      id: 'sheets',
      name: 'Google Sheets API v4',
      desc: 'Kho hàng thời gian thực & Sổ quỹ đơn hàng',
      icon: FileSpreadsheet,
      color: 'text-emerald-400',
      active: serviceStatus.sheets,
      meta: 'Spreadsheet ID: 1Bxi...2upms'
    },
    {
      id: 'gmail',
      name: 'Gmail API v1',
      desc: 'Tự động gửi hóa đơn điện tử kèm mã VietQR',
      icon: Mail,
      color: 'text-red-400',
      active: serviceStatus.gmail,
      meta: 'OAuth2 / Service Account'
    },
    {
      id: 'calendar',
      name: 'Google Calendar API v3',
      desc: 'Lên lịch livestream TikTok, flash sale & nhập hàng',
      icon: Calendar,
      color: 'text-blue-400',
      active: serviceStatus.calendar,
      meta: 'Sync tự động 2 chiều'
    },
    {
      id: 'maps',
      name: 'Google Maps Platform',
      desc: 'Tính khoảng cách giao hàng shipper xe máy & tối ưu tuyến đường',
      icon: MapPin,
      color: 'text-amber-400',
      active: serviceStatus.maps,
      meta: 'Distance Matrix & Geocoding'
    },
    {
      id: 'firestore',
      name: 'Firebase Firestore & Auth',
      desc: 'Lưu trữ nhật ký kiểm toán bất biến & hồ sơ cửa hàng',
      icon: Database,
      color: 'text-orange-400',
      active: serviceStatus.firestore,
      meta: 'Stateful In-Memory / Cloud'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setDrawerOpen(false)}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between dark:bg-slate-950 dark:border-slate-800 light:bg-white light:border-slate-200">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 dark:border-slate-800 light:border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 light:bg-blue-50 light:text-blue-700 light:border-blue-200">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base dark:text-slate-100 light:text-slate-900">
                  Google Ecosystem SPI
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-500">
                  Trạng thái kết nối 6 dịch vụ Google Cloud & Workspace
                </p>
              </div>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 light:text-slate-600 light:hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body: Service List */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 dark:bg-slate-900/60 dark:border-slate-800 light:bg-slate-100 light:border-slate-200">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400 dark:text-emerald-400 light:text-emerald-600" />
                <span className="text-xs font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800">
                  Chế Độ Vận Hành
                </span>
              </div>
              <button
                onClick={toggleMode}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                  mode === 'demo'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40 light:bg-emerald-100 light:text-emerald-800 light:border-emerald-300'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/40 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40 light:bg-blue-100 light:text-blue-800 light:border-blue-300'
                }`}
              >
                {mode === 'demo' ? '🟢 Demo (In-Memory SPI)' : '🔵 Live (Google APIs)'}
              </button>
            </div>

            <div className="space-y-3">
              {services.map((svc) => {
                const Icon = svc.icon;
                return (
                  <div
                    key={svc.id}
                    className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:border-slate-600 transition dark:bg-slate-900/40 dark:border-slate-800 light:bg-slate-50 light:border-slate-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-slate-800 border border-slate-700 ${svc.color} dark:bg-slate-950 dark:border-slate-800 light:bg-white light:border-slate-200`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800">
                            {svc.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 dark:text-slate-400 light:text-slate-600 mt-0.5">
                            {svc.desc}
                          </p>
                          <div className="text-[10px] text-slate-400 dark:text-slate-400 light:text-slate-500 font-mono mt-1">
                            {svc.meta}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {svc.active ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Hoạt động</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 light:bg-amber-50 light:text-amber-800 light:border-amber-200">
                            <AlertCircle className="w-3 h-3" />
                            <span>Mock</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer: Demo Reset Action */}
          <div className="p-6 border-t border-slate-800 dark:border-slate-800 light:border-slate-200 space-y-3 bg-slate-950/50 dark:bg-slate-950/50 light:bg-slate-50">
            <button
              onClick={resetDemoData}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Khôi Phục Dữ Liệu Demo Chuẩn</span>
            </button>
            <p className="text-[11px] text-slate-400 dark:text-slate-400 light:text-slate-500 text-center">
              Đặt lại toàn bộ dữ liệu đơn hàng, kho, lịch sự kiện về cấu hình mẫu sạch.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
