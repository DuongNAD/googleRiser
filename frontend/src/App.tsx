import React from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { EcosystemDrawer } from './components/layout/EcosystemDrawer';
import { ToastContainer } from './components/layout/ToastContainer';
import { DashboardView } from './views/DashboardView';
import { BillAuditView } from './views/BillAuditView';
import { OrdersView } from './views/OrdersView';
import { ProductStudioView } from './views/ProductStudioView';
import { VoiceAssistantView } from './views/VoiceAssistantView';
import { AIPlaygroundView } from './views/AIPlaygroundView';
import { EcosystemSettingsView } from './views/EcosystemSettingsView';

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
          {renderView()}
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
