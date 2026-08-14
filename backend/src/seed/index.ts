/**
 * SME AutoPilot — Vietnamese SME Seed Data Loader
 * backend/src/seed/index.ts
 */

import { InventoryItem, Order, CalendarEvent, StoreBranch, ShopProfile } from '../../../shared';
import * as fashionModule from './fashion.json';
import * as fnbModule from './fnb.json';
import * as cosmeticsModule from './cosmetics.json';
import * as receiptsModule from './test_receipts.json';

export type IndustryType = 'fashion' | 'fnb' | 'cosmetics';

export interface SeedDataset {
  shopProfile: ShopProfile;
  inventory: InventoryItem[];
  orders: Order[];
  calendarEvents: CalendarEvent[];
}

const fashionData: any = (fashionModule as any).default || fashionModule;
const fnbData: any = (fnbModule as any).default || fnbModule;
const cosmeticsData: any = (cosmeticsModule as any).default || cosmeticsModule;
const receiptsData: any = (receiptsModule as any).default || receiptsModule;

export const DEFAULT_STORE_BRANCHES: StoreBranch[] = [
  {
    branchId: 'BR-HN-HQ',
    name: 'Kho Tổng & Flagship Store Hà Nội',
    address: '28 Phố Huế, Phường Hàng Bài, Quận Hoàn Kiếm, Hà Nội',
    district: 'Quận Hoàn Kiếm',
    city: 'Hanoi',
    location: { lat: 21.028511, lng: 105.854167 },
    phone: '02438289999',
    isMainWarehouse: true,
    activeStockCount: 2450
  },
  {
    branchId: 'BR-DN-01',
    name: 'Chi Nhánh Miền Trung - Đà Nẵng',
    address: '45 Nguyễn Văn Linh, Phường Nam Dương, Quận Hải Châu, Đà Nẵng',
    district: 'Quận Hải Châu',
    city: 'Da Nang',
    location: { lat: 16.067778, lng: 108.220833 },
    phone: '02363889999',
    isMainWarehouse: false,
    activeStockCount: 1200
  },
  {
    branchId: 'BR-HCM-01',
    name: 'Chi Nhánh Miền Nam - TP. Hồ Chí Minh',
    address: '128 Nguyễn Trãi, Phường 3, Quận 5, TP. Hồ Chí Minh',
    district: 'Quận 5',
    city: 'Ho Chi Minh City',
    location: { lat: 10.7554, lng: 106.6789 },
    phone: '02838389999',
    isMainWarehouse: false,
    activeStockCount: 1850
  }
];

export function getSeedData(industry: IndustryType = 'fashion'): SeedDataset {
  switch (industry) {
    case 'fnb':
      return fnbData as unknown as SeedDataset;
    case 'cosmetics':
      return cosmeticsData as unknown as SeedDataset;
    case 'fashion':
    default:
      return fashionData as unknown as SeedDataset;
  }
}

export function getSeedInventory(industry: IndustryType = 'fashion'): InventoryItem[] {
  const data = getSeedData(industry);
  return (data.inventory || []).map(item => ({ ...item }));
}

export function getSeedOrders(industry: IndustryType = 'fashion'): Order[] {
  const data = getSeedData(industry);
  return (data.orders || []).map(order => ({ ...order }));
}

export function getSeedShopProfile(industry: IndustryType = 'fashion'): ShopProfile {
  const data = getSeedData(industry);
  return { ...data.shopProfile };
}

export function getSeedCalendarEvents(industry: IndustryType = 'fashion'): CalendarEvent[] {
  const data = getSeedData(industry);
  return (data.calendarEvents || []).map(event => ({ ...event }));
}

export function getTestReceipts(): any[] {
  const list = Array.isArray(receiptsData) ? receiptsData : Object.values(receiptsData);
  return list.map(r => ({ ...r }));
}

export function getStoreBranches(cityFilter?: string): StoreBranch[] {
  if (cityFilter) {
    return DEFAULT_STORE_BRANCHES.filter(b => b.city.toLowerCase() === cityFilter.toLowerCase());
  }
  return DEFAULT_STORE_BRANCHES.map(b => ({ ...b }));
}
