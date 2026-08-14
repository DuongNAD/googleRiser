import React from 'react';
import {
  Sparkles,
  Layers,
  Sun,
  Moon,
  Store,
  ChevronDown,
  Menu,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { useApp, IndustryType } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';

export const Header: React.FC = () => {
  const {
    mode,
    toggleMode,
    industry,
    switchIndustry,
    industryName,
    industryTagline,
    toggleDrawer,
    toggleSidebar,
    serviceStatus
  } = useApp();

  const { theme, toggleTheme } = useTheme();

  const activeServicesCount = Object.values(serviceStatus).filter(Boolean).length;

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between transition-colors dark:border-slate-800 dark:bg-slate-950/90 light:border-slate-200 light:bg-white/90">
      {/* Left: Mobile Toggle & Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition lg:hidden"
          title="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-amber-400 p-[2px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse-subtle" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 text-sm sm:text-base">
                SME AutoPilot
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hidden sm:inline-block">
                #BuildwithGoogleAI
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs font-medium">
              {industryName}
            </p>
          </div>
        </div>
      </div>

      {/* Right: Controls & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Industry Switcher Dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition dark:bg-slate-900 dark:border-slate-800 light:bg-slate-100 light:border-slate-200 light:text-slate-800">
            <Store className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">{industryName}</span>
            <span className="md:hidden">
              {industry === 'fashion' ? 'Thời Trang' : industry === 'fnb' ? 'F&B' : 'Mỹ Phẩm'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          <div className="absolute right-0 mt-1 w-64 p-1.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 dark:bg-slate-900 dark:border-slate-800 light:bg-white light:border-slate-200">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Chọn Ngành Kinh Doanh
            </div>
            <button
              onClick={() => switchIndustry('fashion')}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition flex flex-col ${
                industry === 'fashion'
                  ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                  : 'text-slate-300 hover:bg-slate-800 dark:text-slate-300 light:text-slate-700 light:hover:bg-slate-100'
              }`}
            >
              <span>👗 Thời Trang Mai Anh Silk</span>
              <span className="text-[10px] text-slate-400 font-normal">Áo dài, lụa Hà Đông, váy thiết kế</span>
            </button>
            <button
              onClick={() => switchIndustry('fnb')}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition flex flex-col mt-1 ${
                industry === 'fnb'
                  ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                  : 'text-slate-300 hover:bg-slate-800 dark:text-slate-300 light:text-slate-700 light:hover:bg-slate-100'
              }`}
            >
              <span>🧋 Bếp Mẹ Bắp F&B</span>
              <span className="text-[10px] text-slate-400 font-normal">Trà sữa trân châu, cà phê muối, đồ ăn</span>
            </button>
            <button
              onClick={() => switchIndustry('cosmetics')}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition flex flex-col mt-1 ${
                industry === 'cosmetics'
                  ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                  : 'text-slate-300 hover:bg-slate-800 dark:text-slate-300 light:text-slate-700 light:hover:bg-slate-100'
              }`}
            >
              <span>🌿 GlowSkin Cosmetics</span>
              <span className="text-[10px] text-slate-400 font-normal">Serum rau má diếp cá, kem dưỡng nghệ đỏ</span>
            </button>
          </div>
        </div>

        {/* Demo / Live Mode Switch */}
        <button
          onClick={toggleMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
            mode === 'demo'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
          }`}
          title={mode === 'demo' ? 'Nhấn để chuyển sang Live Mode' : 'Nhấn để chuyển sang Demo Mode'}
        >
          <span className={`w-2 h-2 rounded-full ${mode === 'demo' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`} />
          <span>{mode === 'demo' ? '🟢 Demo Mode' : '🔵 Live Mode'}</span>
        </button>

        {/* Google Ecosystem Drawer Trigger */}
        <button
          onClick={toggleDrawer}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 transition dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 light:bg-slate-100 light:border-slate-200 light:text-slate-700"
          title="Mở bảng trạng thái Google Ecosystem"
        >
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Google SPI</span>
          <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
            {activeServicesCount}/6
          </span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition dark:text-slate-400 dark:hover:bg-slate-800 light:text-slate-600 light:hover:bg-slate-100"
          title={theme === 'dark' ? 'Chuyển sang Chế độ sáng' : 'Chuyển sang Chế độ tối'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>
    </header>
  );
};
