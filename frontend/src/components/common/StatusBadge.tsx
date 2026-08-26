import React from 'react';
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  CheckCheck,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';
import { Order, RiskLevel } from '@shared';

interface StatusBadgeProps {
  type: 'order' | 'payment' | 'risk' | 'sync';
  value: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value, className = '' }) => {
  if (type === 'order') {
    switch (value) {
      case 'DRAFT':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 light:bg-slate-100 light:text-slate-700 light:border-slate-300 ${className}`}>
            <Clock className="w-3 h-3 text-slate-400 dark:text-slate-400 light:text-slate-500" />
            <span>Nháp</span>
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30 light:bg-blue-50 light:text-blue-700 light:border-blue-200 ${className}`}>
            <CheckCircle2 className="w-3 h-3 text-blue-400 dark:text-blue-400 light:text-blue-600" />
            <span>Đã Xác Nhận</span>
          </span>
        );
      case 'PACKING':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 light:bg-amber-50 light:text-amber-800 light:border-amber-200 ${className}`}>
            <Package className="w-3 h-3 text-amber-400 dark:text-amber-400 light:text-amber-600" />
            <span>Đang Đóng Gói</span>
          </span>
        );
      case 'SHIPPED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30 light:bg-purple-50 light:text-purple-700 light:border-purple-200 ${className}`}>
            <Truck className="w-3 h-3 text-purple-400 dark:text-purple-400 light:text-purple-600" />
            <span>Đang Giao Hàng</span>
          </span>
        );
      case 'DELIVERED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-200 ${className}`}>
            <CheckCheck className="w-3 h-3 text-emerald-400 dark:text-emerald-400 light:text-emerald-600" />
            <span>Đã Giao Hàng</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30 light:bg-red-50 light:text-red-700 light:border-red-200 ${className}`}>
            <XCircle className="w-3 h-3 text-red-400 dark:text-red-400 light:text-red-600" />
            <span>Đã Hủy</span>
          </span>
        );
      default:
        return <span className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600">{value}</span>;
    }
  }

  if (type === 'payment') {
    switch (value) {
      case 'PENDING':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 light:bg-amber-50 light:text-amber-800 light:border-amber-200 ${className}`}>
            <Clock className="w-3 h-3" />
            <span>Chờ Thanh Toán</span>
          </span>
        );
      case 'PAID':
      case 'VERIFIED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-200 ${className}`}>
            <CheckCircle2 className="w-3 h-3" />
            <span>Đã Xác Minh VietQR</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30 light:bg-red-50 light:text-red-700 light:border-red-200 ${className}`}>
            <XCircle className="w-3 h-3" />
            <span>Thất Bại</span>
          </span>
        );
      default:
        return <span className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600">{value}</span>;
    }
  }

  if (type === 'risk') {
    switch (value) {
      case 'LOW':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-200 ${className}`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>An Toàn (Tự Động Duyệt)</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 light:bg-amber-50 light:text-amber-800 light:border-amber-200 ${className}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Nghi Vấn</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30 light:bg-red-50 light:text-red-700 light:border-red-200 ${className}`}>
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Rủi Ro Cao</span>
          </span>
        );
      case 'CRITICAL':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950/60 text-red-400 border border-red-700 animate-pulse dark:bg-red-950/60 dark:text-red-400 dark:border-red-700 light:bg-red-100 light:text-red-800 light:border-red-300 ${className}`}>
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Gian Lận Nghiêm Trọng</span>
          </span>
        );
      default:
        return <span className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600">{value}</span>;
    }
  }

  if (type === 'sync') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
        value === 'SYNCED'
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-200'
          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 light:bg-amber-50 light:text-amber-800 light:border-amber-200'
      } ${className}`}>
        <RefreshCw className="w-3 h-3" />
        <span>{value === 'SYNCED' ? 'Đã Đồng Bộ Sheets' : 'Chưa Đồng Bộ'}</span>
      </span>
    );
  }

  return <span className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600">{value}</span>;
};
