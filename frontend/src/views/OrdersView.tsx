import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Truck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Trash2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { googleApi } from '../api/googleApi';
import { StatusBadge } from '../components/common/StatusBadge';
import { VietnameseCurrency } from '../components/common/VietnameseCurrency';
import { formatVietnameseCurrency, formatDateTimeVi } from '../utils/formatting';
import {
  filterOrders,
  transitionOrderStatus,
  OrderStatus,
  paginateOrders
} from '../utils/validators';
import { Order, OrderItem } from '@shared';

export const OrdersView: React.FC = () => {
  const { addToast } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState<boolean>(false);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const res = await googleApi.getOrders();
      if (res.success && res.data) {
        setOrders(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleSyncSheets = async () => {
    setIsSyncing(true);
    try {
      const res = await googleApi.syncSheets('all');
      addToast({
        type: 'success',
        title: 'Đồng Bộ Google Sheets Thành Công',
        message: `Đã đồng bộ ${res.data?.syncedCount || orders.length} đơn hàng vào bảng tính Google Sheets.`
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Lỗi Đồng Bộ',
        message: err.message || 'Không thể đồng bộ với Google Sheets'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatusChange = (orderId: string, currentStatus: OrderStatus, nextStatus: OrderStatus) => {
    try {
      const validNext = transitionOrderStatus(currentStatus, nextStatus);
      setOrders((prev: Order[]) =>
        prev.map((o: Order) => (o.orderId === orderId ? { ...o, orderStatus: validNext, updatedAt: new Date().toISOString() } : o))
      );
      addToast({
        type: 'success',
        title: 'Cập Nhật Trạng Thái Đơn Hàng',
        message: `Đơn ${orderId} đã chuyển sang: ${nextStatus}`
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Chuyển Đổi Không Hợp Lệ',
        message: `Không thể chuyển trực tiếp từ trạng thái "${currentStatus}" sang "${nextStatus}".`
      });
    }
  };

  const handleSendInvoice = async (order: Order) => {
    setIsSendingInvoice(true);
    try {
      const recipient = 'maianh.customer@example.com';
      await googleApi.sendGmailInvoice({
        orderId: order.orderId,
        recipientEmail: recipient,
        items: order.items,
        totalAmount: order.totalAmount
      });
      addToast({
        type: 'success',
        title: 'Đã Gửi Hóa Đơn Qua Gmail',
        message: `Hóa đơn điện tử kèm mã VietQR đã gửi tới: ${recipient}`
      });
      setSelectedOrderForInvoice(null);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Lỗi Gửi Email',
        message: err.message || 'Không thể gửi email qua Gmail API'
      });
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const handleBatchStatusUpdate = (newStatus: OrderStatus) => {
    if (selectedOrderIds.length === 0) {
      addToast({
        type: 'warning',
        title: 'Chưa Chọn Đơn Hàng',
        message: 'Vui lòng tích chọn ít nhất 1 đơn hàng để thao tác hàng loạt.'
      });
      return;
    }

    let successCount = 0;
    let failedCount = 0;

    setOrders((prev: Order[]) =>
      prev.map((o: Order) => {
        if (selectedOrderIds.includes(o.orderId)) {
          try {
            const valid = transitionOrderStatus(o.orderStatus, newStatus);
            successCount++;
            return { ...o, orderStatus: valid, updatedAt: new Date().toISOString() };
          } catch {
            failedCount++;
            return o;
          }
        }
        return o;
      })
    );

    addToast({
      type: successCount > 0 ? 'success' : 'error',
      title: 'Cập Nhật Hàng Loạt Hoàn Tất',
      message: `Đã chuyển ${successCount} đơn sang "${newStatus}"${failedCount > 0 ? ` (${failedCount} đơn không đủ điều kiện chuyển trạng thái)` : ''}.`
    });

    setSelectedOrderIds([]);
  };

  // Filtered orders
  const filtered = filterOrders(orders, {
    orderStatus: orderStatusFilter,
    paymentStatus: paymentStatusFilter,
    search: searchQuery
  });

  // Paginated orders
  const pagination = paginateOrders(filtered, currentPage, pageSize);

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === pagination.data.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(pagination.data.map((o: Order) => o.orderId));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev: string[]) =>
      prev.includes(id) ? prev.filter((item: string) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 light:bg-white light:border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2 light:bg-blue-50 light:text-blue-700 light:border-blue-200">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Đồng Bộ Google Sheets 2 Chiều</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight light:text-slate-900">
            Quản Lý & Xử Lý Đơn Hàng Bán Lẻ
          </h1>
          <p className="text-xs text-slate-400 mt-1 light:text-slate-500">
            Theo dõi trạng thái giao vận, đối soát thanh toán VietQR và xuất hóa đơn Gmail tự động.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncSheets}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Đang Đồng Bộ...' : 'Đồng Bộ Google Sheets'}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 light:border-slate-200">
        {/* Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 light:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Mã đơn, Tên khách hàng, SĐT, Địa chỉ giao hàng..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 light:bg-white light:border-slate-300 light:text-slate-900 light:placeholder-slate-400"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
          {/* Order Status Filter */}
          <select
            value={orderStatusFilter}
            onChange={(e) => {
              setOrderStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 light:bg-white light:border-slate-300 light:text-slate-800"
          >
            <option value="ALL">Tất cả trạng thái đơn</option>
            <option value="DRAFT">Nháp (Draft)</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="PACKING">Đang đóng gói</option>
            <option value="SHIPPED">Đang giao hàng</option>
            <option value="DELIVERED">Đã giao hàng</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentStatusFilter}
            onChange={(e) => {
              setPaymentStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 light:bg-white light:border-slate-300 light:text-slate-800"
          >
            <option value="ALL">Tất cả thanh toán</option>
            <option value="PENDING">Chờ thanh toán</option>
            <option value="VERIFIED">Đã xác minh VietQR</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="FAILED">Thất bại</option>
          </select>
        </div>
      </div>

      {/* Batch Action Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/40 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in light:bg-indigo-50 light:border-indigo-200">
          <span className="font-semibold text-indigo-200 light:text-indigo-800">
            Đã chọn <strong className="text-white light:text-indigo-950">{selectedOrderIds.length}</strong> đơn hàng
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBatchStatusUpdate('CONFIRMED')}
              className="px-3 py-1.5 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 text-white transition"
            >
              Xác Nhận Đơn
            </button>
            <button
              onClick={() => handleBatchStatusUpdate('PACKING')}
              className="px-3 py-1.5 rounded-lg font-bold bg-amber-600 hover:bg-amber-500 text-white transition"
            >
              Đóng Gói
            </button>
            <button
              onClick={() => handleBatchStatusUpdate('SHIPPED')}
              className="px-3 py-1.5 rounded-lg font-bold bg-purple-600 hover:bg-purple-500 text-white transition"
            >
              Giao Vận
            </button>
            <button
              onClick={() => handleBatchStatusUpdate('CANCELLED')}
              className="px-3 py-1.5 rounded-lg font-bold bg-red-600 hover:bg-red-500 text-white transition"
            >
              Hủy Đơn
            </button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden light:border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider light:border-slate-200 light:bg-slate-50/80 light:text-slate-500">
                <th className="py-4 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={pagination.data.length > 0 && selectedOrderIds.length === pagination.data.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer light:border-slate-300"
                  />
                </th>
                <th className="py-4 px-4">Mã Đơn</th>
                <th className="py-4 px-4">Khách Hàng</th>
                <th className="py-4 px-4">Sản Phẩm</th>
                <th className="py-4 px-4">Tổng Tiền</th>
                <th className="py-4 px-4">Thanh Toán</th>
                <th className="py-4 px-4">Trạng Thái Đơn</th>
                <th className="py-4 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 light:divide-slate-200">
              {pagination.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 light:text-slate-500">
                    Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                pagination.data.map((order: Order) => {
                  const isSelected = selectedOrderIds.includes(order.orderId);
                  return (
                    <tr
                      key={order.orderId}
                      className={`hover:bg-slate-800/40 transition light:hover:bg-slate-50 ${
                        isSelected ? 'bg-indigo-950/30 light:bg-indigo-50/60' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(order.orderId)}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer light:border-slate-300"
                        />
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-indigo-300 light:text-indigo-600">
                        {order.orderId}
                        <div className="text-[10px] text-slate-500 font-sans light:text-slate-400">
                          {formatDateTimeVi(order.createdAt)}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-100 light:text-slate-900">{order.customerName}</div>
                        <div className="text-[11px] text-slate-400 light:text-slate-500">{order.customerPhone}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-xs light:text-slate-400">{order.deliveryAddress}</div>
                      </td>
                      <td className="py-4 px-4">
                        {order.items.map((item: OrderItem, idx: number) => (
                          <div key={idx} className="text-slate-300 light:text-slate-700">
                            <span className="font-semibold">{item.name}</span>
                            <span className="text-slate-400 light:text-slate-500"> x{item.quantity}</span>
                          </div>
                        ))}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-white text-sm light:text-slate-900">
                          <VietnameseCurrency amount={order.totalAmount} />
                        </div>
                        {order.discountAmount > 0 && (
                          <div className="text-[10px] text-emerald-400 font-semibold light:text-emerald-600">
                            Giảm: -{formatVietnameseCurrency(order.discountAmount)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <StatusBadge type="payment" value={order.paymentStatus} />
                      </td>
                      <td className="py-4 px-4">
                        <select
                          value={order.orderStatus}
                          onChange={(e) =>
                            handleStatusChange(order.orderId, order.orderStatus, e.target.value as OrderStatus)
                          }
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer light:bg-white light:border-slate-300 light:text-slate-800"
                        >
                          <option value="DRAFT">Nháp</option>
                          <option value="CONFIRMED">Đã Xác Nhận</option>
                          <option value="PACKING">Đang Đóng Gói</option>
                          <option value="SHIPPED">Đang Giao Hàng</option>
                          <option value="DELIVERED">Đã Giao Hàng</option>
                          <option value="CANCELLED">Đã Hủy</option>
                        </select>
                      </td>
                      <td className="py-4 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedOrderForInvoice(order)}
                          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition light:text-slate-600 light:hover:text-slate-900 light:hover:bg-slate-100"
                          title="Gửi hóa đơn Gmail"
                        >
                          <Mail className="w-4 h-4 text-red-400" />
                        </button>
                        <button
                          onClick={() => {
                            addToast({
                              type: 'info',
                              title: 'Google Maps Route',
                              message: `Đang định tuyến giao hàng xe máy đến: ${order.deliveryAddress}`
                            });
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition light:text-slate-600 light:hover:text-slate-900 light:hover:bg-slate-100"
                          title="Tối ưu đường giao shipper"
                        >
                          <MapPin className="w-4 h-4 text-amber-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs light:border-slate-200 light:bg-slate-50/80">
          <span className="text-slate-400 light:text-slate-500">
            Hiển thị <strong className="text-white light:text-slate-900">{pagination.data.length}</strong> / <strong className="text-white light:text-slate-900">{pagination.totalItems}</strong> đơn hàng (Trang {pagination.page} / {pagination.totalPages})
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 transition light:bg-white light:border-slate-300 light:text-slate-700 light:hover:text-slate-900 light:hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-200 px-2 light:text-slate-800">{pagination.page}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 transition light:bg-white light:border-slate-300 light:text-slate-700 light:hover:text-slate-900 light:hover:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Gmail Invoice Dispatch Modal */}
      {selectedOrderForInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm light:bg-slate-900/40">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 light:bg-white light:border-slate-200 light:shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 light:border-slate-200">
              <div className="flex items-center gap-2 text-white font-bold light:text-slate-900">
                <Mail className="w-5 h-5 text-red-400" />
                <span>Gửi Hóa Đơn Điện Tử Qua Gmail</span>
              </div>
              <button
                onClick={() => setSelectedOrderForInvoice(null)}
                className="text-slate-400 hover:text-white light:text-slate-500 light:hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 light:text-slate-600">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 light:bg-slate-50 light:border-slate-200">
                <div><strong>Mã đơn:</strong> <span className="font-mono text-indigo-300 light:text-indigo-600">{selectedOrderForInvoice.orderId}</span></div>
                <div><strong>Người nhận:</strong> {selectedOrderForInvoice.customerName} ({selectedOrderForInvoice.customerPhone})</div>
                <div><strong>Tổng thanh toán:</strong> <span className="text-emerald-400 font-bold light:text-emerald-600">{formatVietnameseCurrency(selectedOrderForInvoice.totalAmount)}</span></div>
              </div>

              <p className="text-slate-400 light:text-slate-500">
                Email hóa đơn sẽ kèm theo mã QR thanh toán chuẩn VietQR và thông tin vận đơn chi tiết.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedOrderForInvoice(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition light:bg-slate-100 light:hover:bg-slate-200 light:text-slate-700"
              >
                Hủy
              </button>
              <button
                onClick={() => handleSendInvoice(selectedOrderForInvoice)}
                disabled={isSendingInvoice}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingInvoice ? 'Đang gửi...' : 'Gửi Hóa Đơn'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
