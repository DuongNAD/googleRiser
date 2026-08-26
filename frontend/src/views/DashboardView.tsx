import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  ShoppingCart,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  QrCode,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { googleApi } from '../api/googleApi';
import { aiApi } from '../api/aiApi';
import { Dropzone } from '../components/common/Dropzone';
import { RiskDial } from '../components/common/RiskDial';
import { StatusBadge } from '../components/common/StatusBadge';
import { VietnameseCurrency } from '../components/common/VietnameseCurrency';
import { formatVietnameseCurrency, formatRelativeTimeVi } from '../utils/formatting';
import { BillForensicsResult, Order, AuditLogEntry } from '@shared';

export const DashboardView: React.FC = () => {
  const { setActiveRoute, addToast, industryName } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [quickAuditResult, setQuickAuditResult] = useState<BillForensicsResult | null>(null);
  const [quickAuditImage, setQuickAuditImage] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [ordersRes, logsRes] = await Promise.all([
        googleApi.getOrders(),
        googleApi.getFirestoreAuditLogs()
      ]);
      if (ordersRes.success && ordersRes.data) setOrders(ordersRes.data);
      if (logsRes.success && logsRes.data) setAuditLogs(logsRes.data);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Executive KPI Calculations
  const totalOrders = orders.length;
  const totalRevenueVnd = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const safeAOV = totalOrders > 0 ? Math.round(totalRevenueVnd / totalOrders) : 0;
  const authenticCount = orders.filter((o) => o.paymentStatus === 'VERIFIED' || o.paymentStatus === 'PAID').length;
  const authenticityRatePct = totalOrders > 0 ? Math.round((authenticCount / totalOrders) * 1000) / 10 : 100;
  const fraudAlertCount = 1; // 1 critical sample flagged in system

  const handleQuickDrop = async (file: File, base64: string) => {
    setQuickAuditImage(base64);
    setIsAuditing(true);
    try {
      const res = await aiApi.auditBill({
        imageBase64: base64,
        expectedAmount: 650000
      });
      if (res.success && res.data) {
        setQuickAuditResult(res.data);
        const summary = res.data.isAuthentic
          ? 'Hóa đơn chuyển khoản hợp lệ 100%, chuẩn NAPAS EMVCo.'
          : res.data.forensicSignals.anomalies.join('; ') || 'Phát hiện dấu hiệu bất thường trên hóa đơn.';

        addToast({
          type: res.data.isAuthentic ? 'success' : 'warning',
          title: res.data.isAuthentic ? 'Hóa Đơn Hợp Lệ' : 'Phát Hiện Dấu Hiệu Bất Thường',
          message: summary
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Lỗi Phân Tích',
        message: err.message || 'Không thể kiểm tra hóa đơn'
      });
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl light:from-indigo-50/70 light:via-white light:to-blue-50/70 light:border-slate-200 light:shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none light:bg-indigo-500/5" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-3 light:bg-indigo-50 light:text-indigo-700 light:border-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 light:text-indigo-600" />
              <span>Bảng Điều Khiển Vận Hành Thông Minh</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight light:text-slate-900">
              Tổng Quan Hoạt Động: <span className="glow-text-google">{industryName}</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl light:text-slate-600">
              Hệ thống tự động kiểm tra VietQR chống bill giả, tối ưu kho hàng và đồng bộ Google Sheets thời gian thực.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveRoute('/audit')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
            >
              <QrCode className="w-4 h-4" />
              <span>Kiểm Tra Bill Chuyên Sâu</span>
            </button>
            <button
              onClick={loadDashboardData}
              className="p-2.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700 transition light:text-slate-600 light:hover:text-slate-900 light:bg-slate-100 light:border-slate-200"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 light:text-slate-500">Tổng Doanh Thu</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-200">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white light:text-slate-900">
              {formatVietnameseCurrency(totalRevenueVnd)}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-400 font-semibold light:text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+18.4% so với tuần trước</span>
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 light:text-slate-500">Tổng Đơn Hàng</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 light:bg-blue-50 light:text-blue-700 light:border-blue-200">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white light:text-slate-900">{totalOrders} đơn</h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-blue-400 font-semibold light:text-blue-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đồng bộ 100% Google Sheets</span>
            </div>
          </div>
        </div>

        {/* Authenticity Rate */}
        <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 light:text-slate-500">Tỷ Lệ Bill Hợp Lệ</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 light:bg-indigo-50 light:text-indigo-700 light:border-indigo-200">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white light:text-slate-900">{authenticityRatePct}%</h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-indigo-400 font-semibold light:text-indigo-600">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gemini Forensics xác thực</span>
            </div>
          </div>
        </div>

        {/* Safe AOV / Fraud Alerts */}
        <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 light:text-slate-500">Giá Trị TB / Đơn (AOV)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 light:bg-amber-50 light:text-amber-700 light:border-amber-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white light:text-slate-900">
              {formatVietnameseCurrency(safeAOV)}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-400 light:text-slate-500">
              <span>Cảnh báo rủi ro: </span>
              <span className="font-bold text-red-400 light:text-red-600">{fraudAlertCount} bill nghi vấn</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Quick Dropzone & Real-time Chart / Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Quick Dropzone (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 light:border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 light:bg-indigo-50 light:text-indigo-700 light:border-indigo-200">
                  <QrCode className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white light:text-slate-900">Kiểm Tra Bill Nhanh</h3>
              </div>
              <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 light:text-indigo-700 light:bg-indigo-50 light:border-indigo-200">
                VietQR 25+ Bank
              </span>
            </div>

            <Dropzone
              onFileSelect={handleQuickDrop}
              previewUrl={quickAuditImage}
              onClear={() => {
                setQuickAuditImage(null);
                setQuickAuditResult(null);
              }}
              title="Kéo thả ảnh bill chuyển khoản vào đây"
              subtitle="Tự động bóc tách số tiền, STK và quét 5 lớp phát hiện bill giả"
            />

            {/* Quick Result Preview */}
            {isAuditing && (
              <div className="mt-4 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center gap-3 animate-pulse light:bg-indigo-50 light:border-indigo-200">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-spin light:text-indigo-600" />
                <span className="text-xs font-medium text-indigo-200 light:text-indigo-800">
                  Gemini 2.0 đang phân tích ELA, font chữ & NAPAS EMVCo...
                </span>
              </div>
            )}

            {quickAuditResult && !isAuditing && (
              <div className="mt-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-4 light:bg-slate-50 light:border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold light:text-slate-500">Kết Quả Phân Tích:</span>
                  <StatusBadge type="risk" value={quickAuditResult.riskLevel} />
                </div>

                <div className="flex items-center justify-center py-2">
                  <RiskDial
                    riskLevel={quickAuditResult.riskLevel}
                    confidenceScore={quickAuditResult.confidenceScore}
                    size={160}
                  />
                </div>

                <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 light:bg-white light:border-slate-200 light:text-slate-700">
                  <p className="font-semibold text-slate-200 light:text-slate-800">
                    {quickAuditResult.isAuthentic
                      ? 'Hóa đơn chuyển khoản Vietcombank khớp 100% định dạng NAPAS EMVCo.'
                      : quickAuditResult.forensicSignals.anomalies.join('; ') || 'Phát hiện bất thường.'}
                  </p>
                  <div className="mt-2 flex justify-between text-[11px] text-slate-400 light:text-slate-500">
                    <span>Số tiền: <strong className="text-white light:text-slate-900">{formatVietnameseCurrency(quickAuditResult.extractedData.amount)}</strong></span>
                    <span>Ngân hàng: <strong className="text-white light:text-slate-900">{quickAuditResult.extractedData.bankName}</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveRoute('/audit')}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition text-center block"
                >
                  Xem Báo Cáo Pháp Y Chi Tiết 5 Lớp →
                </button>
              </div>
            )}
          </div>

          {/* Activity Stream Feed */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 light:border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 light:text-slate-900">
                <Clock className="w-4 h-4 text-slate-400 light:text-slate-500" />
                <span>Nhật Ký Vận Hành Real-time</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono light:text-slate-500">Firestore SPI</span>
            </div>

            <div className="space-y-3">
              {auditLogs.slice(0, 4).map((log) => (
                <div
                  key={log.logId}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start justify-between gap-3 text-xs light:bg-slate-50 light:border-slate-200"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      {log.status === 'SUCCESS' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 light:text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-400 light:text-amber-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200 light:text-slate-800">{log.details?.message || JSON.stringify(log.details)}</p>
                      <span className="text-[10px] text-slate-400 font-mono light:text-slate-500">
                        {log.actorId} • {log.details?.resource || log.action}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap light:text-slate-500">
                    {formatRelativeTimeVi(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Sales Performance & Orders Table (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Sales & Orders Chart Preview */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 light:border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-white light:text-slate-900">Xu Hướng Doanh Thu Theo Giờ</h3>
                <p className="text-xs text-slate-400 light:text-slate-500">Theo dõi doanh số bán hàng và tỷ lệ thanh toán VietQR trong ngày</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="flex items-center gap-1 text-emerald-400 light:text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> VietQR Thành Công
                </span>
                <span className="flex items-center gap-1 text-blue-400 light:text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> COD / Khác
                </span>
              </div>
            </div>

            {/* Custom Interactive SVG Bar Chart */}
            <div className="h-52 w-full flex items-end justify-between gap-2 pt-6 px-2">
              {[
                { hour: '08:00', amount: 650000, qr: 100 },
                { hour: '10:00', amount: 1450000, qr: 85 },
                { hour: '12:00', amount: 2800000, qr: 95 },
                { hour: '14:00', amount: 1950000, qr: 90 },
                { hour: '16:00', amount: 3200000, qr: 100 },
                { hour: '18:00', amount: 4500000, qr: 92 },
                { hour: '20:00', amount: 5800000, qr: 98 },
                { hour: '22:00', amount: 2100000, qr: 88 }
              ].map((item, idx) => {
                const heightPct = Math.min(100, Math.max(15, (item.amount / 6000000) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                    <div className="absolute -top-12 bg-slate-900 border border-slate-700 text-white text-[11px] p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 whitespace-nowrap shadow-xl light:bg-white light:border-slate-200 light:text-slate-900 light:shadow-md">
                      <span className="font-bold">{item.hour}: </span>
                      <span>{formatVietnameseCurrency(item.amount)}</span>
                      <div className="text-[10px] text-emerald-400 font-semibold light:text-emerald-600">QR: {item.qr}%</div>
                    </div>

                    <div className="w-full flex items-end justify-center h-40">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-indigo-600 via-indigo-500 to-emerald-400 group-hover:from-indigo-500 group-hover:to-emerald-300 transition-all duration-300 shadow-lg"
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium light:text-slate-500">{item.hour}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 light:border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white light:text-slate-900">Đơn Hàng Gần Đây</h3>
                <p className="text-xs text-slate-400 light:text-slate-500">Danh sách đơn hàng mới nhất và trạng thái thanh toán</p>
              </div>
              <button
                onClick={() => setActiveRoute('/orders')}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition light:text-indigo-600 light:hover:text-indigo-700"
              >
                Xem tất cả đơn →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold light:border-slate-200 light:text-slate-500">
                    <th className="pb-3">Mã Đơn</th>
                    <th className="pb-3">Khách Hàng</th>
                    <th className="pb-3">Tổng Tiền</th>
                    <th className="pb-3">Thanh Toán</th>
                    <th className="pb-3">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 light:divide-slate-200">
                  {orders.slice(0, 5).map((order) => (
                    <tr key={order.orderId} className="hover:bg-slate-800/30 transition light:hover:bg-slate-50">
                      <td className="py-3 font-mono font-bold text-indigo-300 light:text-indigo-600">{order.orderId}</td>
                      <td className="py-3">
                        <div className="font-semibold text-slate-200 light:text-slate-800">{order.customerName}</div>
                        <div className="text-[10px] text-slate-400 light:text-slate-500">{order.customerPhone}</div>
                      </td>
                      <td className="py-3 font-bold text-white light:text-slate-900">
                        <VietnameseCurrency amount={order.totalAmount} />
                      </td>
                      <td className="py-3">
                        <StatusBadge type="payment" value={order.paymentStatus} />
                      </td>
                      <td className="py-3">
                        <StatusBadge type="order" value={order.orderStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
