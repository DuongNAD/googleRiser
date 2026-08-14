/**
 * Complete Vietnamese Localization Dictionary for SME AutoPilot
 */

export const VI_VN_LOCALE: Record<string, string> = {
  // Navigation
  'nav.dashboard': 'Tổng Quan',
  'nav.audit': 'Kiểm Tra Bill',
  'nav.orders': 'Đơn Hàng',
  'nav.studio': 'Product Studio',
  'nav.voice': 'Trợ Lý Giọng Nói',
  'nav.playground': 'AI Studio',
  'nav.ecosystem': 'Google Ecosystem',

  // Mode & Theme
  'mode.demo': 'Chế độ Demo (Giả lập)',
  'mode.live': 'Chế độ Trực Tiếp (Live API)',
  'theme.dark': 'Chế độ tối',
  'theme.light': 'Chế độ sáng',

  // Dashboard & Forensics
  'dashboard.title': 'Bảng Điều Khiển Tổng Quan',
  'dashboard.revenue': 'Tổng Doanh Thu',
  'dashboard.orders': 'Tổng Đơn Hàng',
  'dashboard.authenticity': 'Tỷ Lệ Bill Hợp Lệ',
  'dashboard.aov': 'Giá Trị TB / Đơn',
  'dashboard.fraudAlerts': 'Cảnh Báo Gian Lận',
  'dashboard.emptyAudit': 'Không có hóa đơn cần duyệt',
  'audit.dropzone': 'Kéo thả ảnh hóa đơn chuyển khoản hoặc VietQR vào đây',
  'audit.dropzoneHint': 'Hỗ trợ PNG, JPG, WEBP, PDF tối đa 10MB',
  'audit.risk.low': 'An Toàn (Tự Động Duyệt)',
  'audit.risk.medium': 'Cần Kiểm Tra Lại',
  'audit.risk.high': 'Rủi Ro Cao (Từ Chối)',
  'audit.risk.critical': 'Gian Lận Nghiêm Trọng',
  'audit.btn_submit': 'Kiểm Tra Hóa Đơn',
  'audit.reconciliation.matched': 'Đã Khớp Đơn Hàng',
  'audit.reconciliation.unmatched': 'Chưa Khớp Đơn Hàng',
  'audit.reconciliation.flagged': 'Hóa Đơn Bị Cảnh Báo',

  // Orders
  'order.title': 'Quản Lý Đơn Hàng',
  'order.status.draft': 'Nháp',
  'order.status.confirmed': 'Đã Xác Nhận',
  'order.status.packing': 'Đang Đóng Gói',
  'order.status.shipped': 'Đang Giao Hàng',
  'order.status.delivered': 'Đã Giao Hàng',
  'order.status.cancelled': 'Đã Hủy',
  'order.payment.pending': 'Chờ Thanh Toán',
  'order.payment.paid': 'Đã Thanh Toán',
  'order.payment.verified': 'Đã Xác Minh',
  'order.payment.failed': 'Thất Bại',
  'order.syncSheets': 'Đồng Bộ Google Sheets',
  'order.sendInvoice': 'Gửi Hóa Đơn Gmail',
  'order.optimizeRoute': 'Tối Ưu Tuyến Đường Giao',

  // Product Studio
  'studio.title': 'Product Studio & Visual Workbench',
  'studio.theme.luxury': 'Sang Trọng Tinh Tế (Luxury Minimalist)',
  'studio.theme.cyberpunk': 'Hiện Đại Cá Tính (Neon Cyberpunk)',
  'studio.theme.pastel': 'Ấm Áp Phong Cách Sống (Pastel Cozy)',
  'studio.theme.tet': 'Tết Cổ Truyền Việt Nam (Traditional Tết)',
  'studio.generateCopy': 'Tạo Bài Đăng Bán Hàng Đa Kênh',
  'studio.copySuccess': 'Đã sao chép nội dung vào clipboard!',

  // Voice Assistant
  'voice.title': 'Trợ Lý Giọng Nói AI Đa Phương Ngữ',
  'voice.listening': 'Đang lắng nghe bạn nói...',
  'voice.processing': 'Đang xử lý & phân tích...',
  'voice.dialect.north': 'Giọng Bắc (Hà Nội)',
  'voice.dialect.central': 'Giọng Trung (Đà Nẵng / Huế)',
  'voice.dialect.south': 'Giọng Nam (Sài Gòn / Miền Tây)',
  'voice.dialect.auto': 'Tự Động Nhận Diện',
  'voice.silencePrompt': 'Tôi chưa nghe rõ, bạn có thể nói lại được không?',
  'voice.permDenied': 'Trình duyệt chưa được cấp quyền micro. Bạn có thể nhập tin nhắn văn bản bên dưới.',

  // Google Ecosystem
  'ecosystem.title': 'Google Ecosystem SPI & Cài Đặt',
  'ecosystem.sheets': 'Google Sheets API v4',
  'ecosystem.gmail': 'Gmail API v1',
  'ecosystem.calendar': 'Google Calendar API v3',
  'ecosystem.maps': 'Google Maps Platform',
  'ecosystem.firestore': 'Firebase Firestore & Auth',
  'ecosystem.gemini': 'Google Gemini 2.0 Multimodal API',
  'ecosystem.resetDemo': 'Khôi Phục Dữ Liệu Demo',
  'ecosystem.switchIndustry': 'Chuyển Đổi Ngành Hàng'
};

export function resolveTranslation(key: string, translations: Record<string, string> = VI_VN_LOCALE): string {
  if (!key || key.trim() === '') return '';
  if (translations[key] !== undefined) {
    return translations[key];
  }
  const parts = key.split('.');
  const lastPart = parts[parts.length - 1];
  return `[vi:${lastPart}]`;
}
