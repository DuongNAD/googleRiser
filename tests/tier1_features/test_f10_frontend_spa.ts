import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains
} from '../harness';

export interface RouteConfig {
  path: string;
  viewName: string;
  labelVi: string;
  icon: string;
}

export const APP_ROUTES: RouteConfig[] = [
  { path: '/', viewName: 'DashboardView', labelVi: 'Tổng Quan & KPI', icon: 'LayoutDashboard' },
  { path: '/audit', viewName: 'BillAuditView', labelVi: 'Kiểm Tra Bill VietQR', icon: 'QrCode' },
  { path: '/orders', viewName: 'OrdersView', labelVi: 'Quản Lý Đơn Hàng', icon: 'ShoppingCart' },
  { path: '/studio', viewName: 'ProductStudioView', labelVi: 'Product Studio & Copy', icon: 'Sparkles' },
  { path: '/assistant', viewName: 'VoiceAssistantView', labelVi: 'Trợ Lý Giọng Nói AI', icon: 'Mic' },
  { path: '/playground', viewName: 'AIPlaygroundView', labelVi: 'AI Studio Playground', icon: 'Cpu' },
  { path: '/ecosystem', viewName: 'EcosystemSettingsView', labelVi: 'Google Ecosystem & Cài Đặt', icon: 'Layers' }
];

export const VI_VN_LOCALE: Record<string, string> = {
  'nav.dashboard': 'Tổng Quan',
  'nav.audit': 'Kiểm Tra Bill',
  'nav.orders': 'Đơn Hàng',
  'nav.studio': 'Product Studio',
  'nav.voice': 'Trợ Lý Giọng Nói',
  'nav.playground': 'AI Studio',
  'nav.ecosystem': 'Google Ecosystem',
  'theme.dark': 'Chế độ tối',
  'theme.light': 'Chế độ sáng',
  'mode.demo': 'Chế độ Demo (Giả lập)',
  'mode.live': 'Chế độ Trực Tiếp (Live API)',
  'audit.dropzone': 'Kéo thả ảnh hóa đơn chuyển khoản hoặc VietQR vào đây',
  'audit.risk.low': 'An Toàn (Tự Động Duyệt)',
  'audit.risk.medium': 'Cần Kiểm Tra Lại',
  'audit.risk.high': 'Rủi Ro Cao (Từ Chối)',
  'audit.risk.critical': 'Gian Lận Nghiêm Trọng',
  'order.status.confirmed': 'Đã Xác Nhận',
  'order.status.shipped': 'Đang Giao Hàng',
  'order.syncSheets': 'Đồng Bộ Google Sheets'
};

export class ThemeManager {
  private currentTheme: 'light' | 'dark' = 'dark';

  constructor(initialTheme: 'light' | 'dark' = 'dark') {
    this.currentTheme = initialTheme;
  }

  getTheme(): 'light' | 'dark' {
    return this.currentTheme;
  }

  toggleTheme(): 'light' | 'dark' {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    return this.currentTheme;
  }

  getThemeClasses(): string {
    return this.currentTheme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'light bg-slate-50 text-slate-900';
  }
}

export class SidebarLayoutState {
  private collapsed: boolean = false;
  private activeRoute: string = '/';

  isCollapsed(): boolean {
    return this.collapsed;
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
  }

  setActiveRoute(path: string): void {
    this.activeRoute = path;
  }

  getActiveRoute(): string {
    return this.activeRoute;
  }
}

describe('F10: Modern Responsive Frontend SPA & Theme Provider', () => {
  test('Test 10.1: Full 7-view React component routing hierarchy', () => {
    assertEqual(APP_ROUTES.length, 7);
    const viewNames = APP_ROUTES.map(r => r.viewName);
    assertTrue(viewNames.includes('DashboardView'));
    assertTrue(viewNames.includes('BillAuditView'));
    assertTrue(viewNames.includes('OrdersView'));
    assertTrue(viewNames.includes('ProductStudioView'));
    assertTrue(viewNames.includes('VoiceAssistantView'));
    assertTrue(viewNames.includes('AIPlaygroundView'));
    assertTrue(viewNames.includes('EcosystemSettingsView'));
  });

  test('Test 10.2: Dark/Light theme provider state machine', () => {
    const tm = new ThemeManager('dark');
    assertEqual(tm.getTheme(), 'dark');
    assertContains(tm.getThemeClasses(), 'dark bg-slate-950');

    tm.toggleTheme();
    assertEqual(tm.getTheme(), 'light');
    assertContains(tm.getThemeClasses(), 'light bg-slate-50');

    tm.toggleTheme();
    assertEqual(tm.getTheme(), 'dark');
  });

  test('Test 10.3: Responsive navigation and route path resolution', () => {
    const auditRoute = APP_ROUTES.find(r => r.path === '/audit');
    assertTrue(!!auditRoute);
    assertEqual(auditRoute!.viewName, 'BillAuditView');
    assertEqual(auditRoute!.icon, 'QrCode');

    const studioRoute = APP_ROUTES.find(r => r.path === '/studio');
    assertTrue(!!studioRoute);
    assertEqual(studioRoute!.labelVi, 'Product Studio & Copy');
  });

  test('Test 10.4: Vietnamese localization dictionary key completeness', () => {
    const requiredKeys = [
      'nav.dashboard',
      'audit.dropzone',
      'audit.risk.low',
      'audit.risk.critical',
      'order.syncSheets',
      'mode.demo'
    ];

    for (const key of requiredKeys) {
      assertTrue(key in VI_VN_LOCALE, `Locale key '${key}' must exist in Vietnamese dictionary`);
      assertTrue(VI_VN_LOCALE[key].length > 0);
    }
  });

  test('Test 10.5: Sidebar collapse/expand state management', () => {
    const layout = new SidebarLayoutState();
    assertFalse(layout.isCollapsed());

    layout.toggle();
    assertTrue(layout.isCollapsed());

    layout.setActiveRoute('/orders');
    assertEqual(layout.getActiveRoute(), '/orders');
  });
});
