import React, { Suspense } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { EcosystemDrawer } from './components/layout/EcosystemDrawer';
import { ToastContainer } from './components/layout/ToastContainer';
import { DashboardView } from './views/DashboardView';

// Code-split secondary views for optimized initial bundle delivery
const BillAuditView = React.lazy(() => import('./views/BillAuditView').then(m => ({ default: m.BillAuditView })));
const OrdersView = React.lazy(() => import('./views/OrdersView').then(m => ({ default: m.OrdersView })));
const ProductStudioView = React.lazy(() => import('./views/ProductStudioView').then(m => ({ default: m.ProductStudioView })));
const VoiceAssistantView = React.lazy(() => import('./views/VoiceAssistantView').then(m => ({ default: m.VoiceAssistantView })));
const AIPlaygroundView = React.lazy(() => import('./views/AIPlaygroundView').then(m => ({ default: m.AIPlaygroundView })));
const EcosystemSettingsView = React.lazy(() => import('./views/EcosystemSettingsView').then(m => ({ default: m.EcosystemSettingsView })));

const ViewLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center space-y-3">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-sm text-slate-400">Đang tải giao diện...</span>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { activeRoute } = useApp();

  const renderView = () => {
    switch (activeRoute) {
      case '/':
        return <DashboardView />;
      case '/audit':
        return <BillAuditView />;
      case '/orders':
        return <OrdersView />;
      case '/studio':
        return <ProductStudioView />;
      case '/assistant':
        return <VoiceAssistantView />;
      case '/playground':
        return <AIPlaygroundView />;
      case '/ecosystem':
        return <EcosystemSettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors dark:bg-slate-950 dark:text-slate-100 light:bg-slate-50 light:text-slate-900">
      <Header />

      <div className="flex-1 flex min-h-[calc(100vh-4rem)]">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto w-full max-w-[1536px] mx-auto">
          <Suspense fallback={<ViewLoadingFallback />}>
            {renderView()}
          </Suspense>
        </main>
      </div>

      <EcosystemDrawer />
      <ToastContainer />
    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};

export default App;
