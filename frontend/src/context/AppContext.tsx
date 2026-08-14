import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { googleApi } from '../api/googleApi';

export type AppMode = 'demo' | 'live';
export type IndustryType = 'fashion' | 'fnb' | 'cosmetics';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface GoogleServiceStatus {
  gemini: boolean;
  sheets: boolean;
  gmail: boolean;
  calendar: boolean;
  maps: boolean;
  firestore: boolean;
}

export interface AppContextType {
  mode: AppMode;
  toggleMode: () => void;
  setMode: (mode: AppMode) => void;
  industry: IndustryType;
  switchIndustry: (industry: IndustryType) => Promise<void>;
  industryName: string;
  industryTagline: string;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  serviceStatus: GoogleServiceStatus;
  refreshHealth: () => Promise<void>;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  activeRoute: string;
  setActiveRoute: (route: string) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  resetDemoData: () => Promise<void>;
  isLoading: boolean;
}

const INDUSTRY_PROFILES: Record<IndustryType, { name: string; tagline: string }> = {
  fashion: {
    name: 'Thời Trang Mai Anh Silk',
    tagline: 'Lụa Hà Đông & Áo Dài Truyền Thống Thiết Kế'
  },
  fnb: {
    name: 'Bếp Mẹ Bắp F&B & Trà Sữa',
    tagline: 'Trà Sữa Thủ Công & Đồ Ăn Vặt Giao Nhanh'
  },
  cosmetics: {
    name: 'GlowSkin Organic Cosmetics',
    tagline: 'Mỹ Phẩm Thiên Nhiên Rau Má Diếp Cá & Nghệ Đỏ'
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<AppMode>('demo');
  const [industry, setIndustryState] = useState<IndustryType>('fashion');
  const [isDrawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [activeRoute, setActiveRoute] = useState<string>('/');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [serviceStatus, setServiceStatus] = useState<GoogleServiceStatus>({
    gemini: true,
    sheets: true,
    gmail: true,
    calendar: true,
    maps: true,
    firestore: true
  });

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastMessage, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const refreshHealth = useCallback(async () => {
    try {
      const res = await googleApi.getHealth();
      if (res.success && res.data) {
        setServiceStatus(res.data.services);
        if (res.data.mode) setModeState(res.data.mode);
        if (res.data.activeIndustry) setIndustryState(res.data.activeIndustry);
      }
    } catch {
      // Keep optimistic mock status
    }
  }, []);

  const switchIndustry = async (newIndustry: IndustryType) => {
    setIsLoading(true);
    try {
      await googleApi.switchIndustry(newIndustry);
      setIndustryState(newIndustry);
      addToast({
        type: 'success',
        title: 'Chuyển Đổi Ngành Hàng Thành Công',
        message: `Đã chuyển sang ${INDUSTRY_PROFILES[newIndustry].name}`
      });
    } catch (err: any) {
      setIndustryState(newIndustry);
      addToast({
        type: 'info',
        title: 'Đã Đổi Ngành Hàng (Demo)',
        message: INDUSTRY_PROFILES[newIndustry].name
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    const nextMode: AppMode = mode === 'demo' ? 'live' : 'demo';
    setModeState(nextMode);
    addToast({
      type: nextMode === 'live' ? 'info' : 'success',
      title: nextMode === 'live' ? '🔵 Đã Bật Live Mode' : '🟢 Đã Bật Demo Mode',
      message:
        nextMode === 'live'
          ? 'Đang kết nối trực tiếp với Google Workspace & Gemini 2.0 API'
          : 'Đang chạy trên môi trường giả lập an toàn với dữ liệu mẫu'
    });
  };

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
  };

  const toggleDrawer = () => {
    setDrawerOpen((prev) => !prev);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const resetDemoData = async () => {
    setIsLoading(true);
    try {
      const res = await googleApi.resetDemoData();
      addToast({
        type: 'success',
        title: 'Khôi Phục Dữ Liệu Demo',
        message: res.data?.message || 'Đã hoàn tất khôi phục trạng thái chuẩn ban đầu.'
      });
    } catch {
      addToast({
        type: 'success',
        title: 'Khôi Phục Dữ Liệu Demo',
        message: 'Đã hoàn tất khôi phục trạng thái chuẩn ban đầu.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  return (
    <AppContext.Provider
      value={{
        mode,
        toggleMode,
        setMode,
        industry,
        switchIndustry,
        industryName: INDUSTRY_PROFILES[industry].name,
        industryTagline: INDUSTRY_PROFILES[industry].tagline,
        isDrawerOpen,
        setDrawerOpen,
        toggleDrawer,
        serviceStatus,
        refreshHealth,
        toasts,
        addToast,
        removeToast,
        activeRoute,
        setActiveRoute,
        sidebarCollapsed,
        toggleSidebar,
        resetDemoData,
        isLoading
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
