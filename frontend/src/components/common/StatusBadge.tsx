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
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 ${className}`}>
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Nháp</span>
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 ${className}`}>
            <CheckCircle2 className="w-3 h-3 text-blue-400" />
            <span>Đã Xác Nhận</span>
          </span>
        );
      case 'PACKING':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 ${className}`}>
            <Package className="w-3 h-3 text-amber-400" />
            <span>Đang Đóng Gói</span>
          </span>
        );
      case 'SHIPPED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 ${className}`}>
            <Truck className="w-3 h-3 text-purple-400" />
            <span>Đang Giao Hàng</span>
          </span>
        );
      case 'DELIVERED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${className}`}>
            <CheckCheck className="w-3 h-3 text-emerald-400" />
            <span>Đã Giao Hàng</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 ${className}`}>
            <XCircle className="w-3 h-3 text-red-400" />
            <span>Đã Hủy</span>
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{value}</span>;
    }
  }

  if (type === 'payment') {
    switch (value) {
      case 'PENDING':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 ${className}`}>
            <Clock className="w-3 h-3" />
            <span>Chờ Thanh Toán</span>
          </span>
        );
      case 'PAID':
      case 'VERIFIED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${className}`}>
            <CheckCircle2 className="w-3 h-3" />
            <span>Đã Xác Minh VietQR</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 ${className}`}>
            <XCircle className="w-3 h-3" />
            <span>Thất Bại</span>
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{value}</span>;
    }
  }

  if (type === 'risk') {
    switch (value) {
      case 'LOW':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${className}`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>An Toàn (Tự Động Duyệt)</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 ${className}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Nghi Vấn</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 ${className}`}>
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Rủi Ro Cao</span>
          </span>
        );
      case 'CRITICAL':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950/60 text-red-400 border border-red-700 animate-pulse ${className}`}>
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Gian Lận Nghiêm Trọng</span>
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{value}</span>;
    }
  }

  if (type === 'sync') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
        value === 'SYNCED'
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      } ${className}`}>
        <RefreshCw className="w-3 h-3" />
        <span>{value === 'SYNCED' ? 'Đã Đồng Bộ Sheets' : 'Chưa Đồng Bộ'}</span>
      </span>
    );
  }

  return <span className="text-xs text-slate-400">{value}</span>;
};
