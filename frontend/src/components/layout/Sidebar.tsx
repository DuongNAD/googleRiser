import React from 'react';
import {
  LayoutDashboard,
  QrCode,
  ShoppingCart,
  Sparkles,
  Mic,
  Cpu,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface RouteConfig {
  path: string;
  viewName: string;
  labelVi: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

export const NAV_ITEMS: RouteConfig[] = [
  { path: '/', viewName: 'DashboardView', labelVi: 'Tổng Quan & KPI', icon: LayoutDashboard },
  { path: '/audit', viewName: 'BillAuditView', labelVi: 'Kiểm Tra Bill VietQR', icon: QrCode, badge: '5-Layer', badgeColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' },
  { path: '/orders', viewName: 'OrdersView', labelVi: 'Quản Lý Đơn Hàng', icon: ShoppingCart, badge: 'Sheets Sync', badgeColor: 'bg-blue-500/10 text-blue-400 border border-blue-500/30' },
  { path: '/studio', viewName: 'ProductStudioView', labelVi: 'Product Studio & Copy', icon: Sparkles, badge: 'Imagen 3', badgeColor: 'bg-purple-500/10 text-purple-400 border border-purple-500/30' },
  { path: '/assistant', viewName: 'VoiceAssistantView', labelVi: 'Trợ Lý Giọng Nói AI', icon: Mic, badge: 'Voice', badgeColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/30' },
  { path: '/playground', viewName: 'AIPlaygroundView', labelVi: 'AI Studio Playground', icon: Cpu, badge: 'Gemini 2.0', badgeColor: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' },
  { path: '/ecosystem', viewName: 'EcosystemSettingsView', labelVi: 'Google Ecosystem & Cài Đặt', icon: Layers }
];

export const Sidebar: React.FC = () => {
  const { activeRoute, setActiveRoute, sidebarCollapsed, toggleSidebar, mode } = useApp();

  return (
    <aside
      className={`fixed lg:static top-16 bottom-0 left-0 z-20 flex flex-col justify-between border-r border-slate-800 bg-slate-900/95 backdrop-blur-md transition-all duration-300 dark:border-slate-800 dark:bg-slate-950/95 light:border-slate-200 light:bg-white/95 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Section: Navigation Links */}
      <div className="p-3 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.path;

          return (
            <button
              key={item.path}
              onClick={() => setActiveRoute(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 light:text-slate-600 light:hover:text-slate-900 light:hover:bg-slate-100'
              }`}
              title={sidebarCollapsed ? item.labelVi : undefined}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                }`}
              />

              {!sidebarCollapsed && (
                <div className="flex items-center justify-between flex-1 truncate">
                  <span className="truncate">{item.labelVi}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}

              {/* Active Indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Section: Collapse Toggle & System Badge */}
      <div className="p-3 border-t border-slate-800 dark:border-slate-800 light:border-slate-200 space-y-2">
        {!sidebarCollapsed && (
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 dark:bg-slate-900/60 dark:border-slate-800 light:bg-slate-100 light:border-slate-200">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 dark:text-slate-300 light:text-slate-800">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Forensics Engine</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">25+ Banks</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Phát hiện Photoshop, font mismatch & nghịch lý đồng hồ VietQR.
            </p>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition dark:text-slate-400 dark:hover:bg-slate-800 light:text-slate-600 light:hover:bg-slate-100"
          title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium">
              <ChevronLeft className="w-4 h-4" />
              <span>Thu gọn menu</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
