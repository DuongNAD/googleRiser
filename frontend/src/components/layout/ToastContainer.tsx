import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useApp, ToastMessage } from '../../context/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all duration-200 animate-in slide-in-from-bottom-5 ${
              toast.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/40 text-slate-100 shadow-emerald-950/40 dark:bg-slate-900/95 dark:border-emerald-500/40 dark:text-slate-100 dark:shadow-emerald-950/40 light:bg-white/95 light:border-emerald-200 light:text-slate-900 light:shadow-emerald-500/10'
                : toast.type === 'error'
                ? 'bg-slate-900/95 border-red-500/40 text-slate-100 shadow-red-950/40 dark:bg-slate-900/95 dark:border-red-500/40 dark:text-slate-100 dark:shadow-red-950/40 light:bg-white/95 light:border-red-200 light:text-slate-900 light:shadow-red-500/10'
                : toast.type === 'warning'
                ? 'bg-slate-900/95 border-amber-500/40 text-slate-100 shadow-amber-950/40 dark:bg-slate-900/95 dark:border-amber-500/40 dark:text-slate-100 dark:shadow-amber-950/40 light:bg-white/95 light:border-amber-200 light:text-slate-900 light:shadow-amber-500/10'
                : 'bg-slate-900/95 border-blue-500/40 text-slate-100 shadow-blue-950/40 dark:bg-slate-900/95 dark:border-blue-500/40 dark:text-slate-100 dark:shadow-blue-950/40 light:bg-white/95 light:border-blue-200 light:text-slate-900 light:shadow-blue-500/10'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 dark:text-emerald-400 light:text-emerald-600" />}
              {toast.type === 'error' && <XCircle className="w-5 h-5 text-red-400 dark:text-red-400 light:text-red-600" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 dark:text-amber-400 light:text-amber-600" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400 dark:text-blue-400 light:text-blue-600" />}
            </div>

            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-slate-100 dark:text-slate-100 light:text-slate-900">{toast.title}</h5>
              {toast.message && (
                <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600 mt-0.5 break-words">{toast.message}</p>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 light:text-slate-500 light:hover:text-slate-800 light:hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
