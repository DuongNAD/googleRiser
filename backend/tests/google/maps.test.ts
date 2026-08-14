/**
 * SME AutoPilot — Google Maps Service Test Suite
 * backend/tests/google/maps.test.ts
 */

import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertRange,
  assertContains,
  assertThrows
} from '../../../tests/harness';
import { MockMapsService } from '../../src/google/maps/MockMapsService';
import { LiveMapsService } from '../../src/google/maps/LiveMapsService';
import { LatLng } from '@shared/types';

describe('Google Maps Platform & Motorbike Routing Test Suite', () => {
  test('Maps: Haversine distance engine applies 1.35x Vietnamese urban tortuosity multiplier', async () => {
    const service = new MockMapsService();

    // Hoan Kiem (21.028511, 105.854167) to Ba Dinh (21.0341, 105.8244)
    const hoanKiem: LatLng = { lat: 21.028511, lng: 105.854167 };
    const baDinh: LatLng = { lat: 21.0341, lng: 105.8244 };

    const geodesic = service.calculateGeodesicDistanceKm(hoanKiem, baDinh);
    const urban = service.calculateUrbanDistanceKm(hoanKiem, baDinh, 1.35);

    assertRange(geodesic, 2.5, 3.5, 'Geodesic distance between Hoan Kiem and Ba Dinh');
    assertTrue(urban > geodesic, 'Urban distance must include winding tortuosity factor');
    assertEqual(urban, Math.round(geodesic * 1.35 * 10) / 10);
  });

  test('Maps: 4-Tier Vietnamese motorbike shipping rate calculation across all distance bands', async () => {
    const service = new MockMapsService();

    // 1. Tier 1: <= 3.0 km -> 18,000 VND flat
    const rateTier1 = service.calculateShippingRate(2.5);
    assertEqual(rateTier1.shippingRateVnd, 18000);
    assertEqual(rateTier1.rateTier, 'STANDARD_INNER_CITY');

    // 2. Tier 1 (extended): 3.1 - 7.0 km -> 18,000 + (d - 3) * 4,000
    // At 5.0 km: 18,000 + 2 * 4,000 = 26,000 VND
    const rateTier1Ext = service.calculateShippingRate(5.0);
    assertEqual(rateTier1Ext.shippingRateVnd, 26000);
    assertEqual(rateTier1Ext.rateTier, 'STANDARD_INNER_CITY');

    // 3. Tier 2: 7.1 - 15.0 km (Suburb) -> 35,000 + (d - 7) * 3,500
    // At 10.0 km: 35,000 + 3 * 3,500 = 45,500 VND
    const rateTier2 = service.calculateShippingRate(10.0);
    assertEqual(rateTier2.shippingRateVnd, 45500);
    assertEqual(rateTier2.rateTier, 'SUBURB');

    // 4. Tier 3: > 15.0 km (Inter-Provincial) -> 55,000 + (d - 15) * 5,000
    // At 20.0 km: 55,000 + 5 * 5,000 = 80,000 VND
    const rateTier3 = service.calculateShippingRate(20.0);
    assertEqual(rateTier3.shippingRateVnd, 80000);
    assertEqual(rateTier3.rateTier, 'INTER_PROVINCIAL');

    // 5. Tier 4: Rush Hour / Express Surge (+15%)
    const rushRate = service.calculateShippingRate(5.0, { isRushHour: true });
    assertEqual(rushRate.shippingRateVnd, Math.round(26000 * 1.15));
    assertTrue(rushRate.breakdown.peakHourSurchargeVnd > 0);
  });

  test('Maps: Multi-Stop TSP delivery route optimizer sequences stops to minimize transit time', async () => {
    const service = new MockMapsService();
    const depot: LatLng = { lat: 21.028511, lng: 105.854167 }; // 28 Pho Hue HQ

    const stops = [
      { id: 'O-FAR', address: 'Hà Đông (Xa nhất)', location: { lat: 20.9723, lng: 105.7772 } },
      { id: 'O-NEAR', address: 'Tràng Tiền (Gần nhất)', location: { lat: 21.0244, lng: 105.8577 } },
      { id: 'O-MID', address: 'Cầu Giấy (Trung bình)', location: { lat: 21.0362, lng: 105.7906 } }
    ];

    const result = await service.optimizeDeliveryRoute(depot, stops as any);

    assertEqual(result.totalOrders, 3);
    assertEqual(result.optimizedStops.length, 3);
    // Nearest stop (Tràng Tiền) should be sequenced before Hà Đông
    assertEqual(result.optimizedStops[0].orderId, 'O-NEAR');
    assertTrue(result.totalDistanceKm > 0);
    assertTrue(result.totalDurationMinutes > 0);
    assertTrue(result.efficiencyGainPercent !== undefined && result.efficiencyGainPercent >= 0);
  });

  test('Maps: Store branch locator and nearest warehouse resolver for Hanoi, Da Nang, HCMC', async () => {
    const service = new MockMapsService();
    const branches = await service.getStoreBranches();

    assertEqual(branches.length, 3);
    assertTrue(branches.some(b => b.city === 'Hanoi' && b.isMainWarehouse));
    assertTrue(branches.some(b => b.city === 'Da Nang'));
    assertTrue(branches.some(b => b.city === 'Ho Chi Minh City'));

    // Filter by city
    const hcmBranches = await service.getStoreBranches('Ho Chi Minh City');
    assertEqual(hcmBranches.length, 1);
    assertEqual(hcmBranches[0].city, 'Ho Chi Minh City');

    // Nearest branch resolver
    const hanoiCustomer: LatLng = { lat: 21.0362, lng: 105.7906 }; // Cầu Giấy
    const nearest = service.findNearestBranch(hanoiCustomer);
    assertEqual(nearest.branch.city, 'Hanoi');
    assertRange(nearest.distanceKm, 2.0, 15.0);
  });

  test('Maps: Geocodes Vietnamese district names to realistic city coordinates', async () => {
    const service = new MockMapsService();

    const hnCoords = await service.geocodeAddress('45 Tràng Tiền, Quận Hoàn Kiếm, Hà Nội');
    assertRange(hnCoords.lat, 20.9, 21.2);
    assertRange(hnCoords.lng, 105.7, 105.9);

    const dnCoords = await service.geocodeAddress('120 Nguyễn Văn Linh, Quận Hải Châu, Đà Nẵng');
    assertRange(dnCoords.lat, 15.9, 16.2);
    assertRange(dnCoords.lng, 108.1, 108.3);

    const hcmCoords = await service.geocodeAddress('128 Nguyễn Trãi, Quận 5, TP Hồ Chí Minh');
    assertRange(hcmCoords.lat, 10.6, 10.9);
    assertRange(hcmCoords.lng, 106.5, 106.8);
  });

  test('Maps: LiveMapsService operates cleanly with fallback', async () => {
    const liveService = new LiveMapsService();
    const res = await liveService.calculateDistance(
      '28 Phố Huế, Hoàn Kiếm, Hà Nội',
      '45 Tràng Tiền, Hoàn Kiếm, Hà Nội'
    );
    assertTrue(res.distanceKm > 0);
    assertTrue(res.shippingRateVnd >= 18000);
  });
});
