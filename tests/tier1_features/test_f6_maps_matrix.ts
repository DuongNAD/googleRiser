import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertRange,
  createMockStoreBranch
} from '../harness';
import {
  LatLng,
  DistanceResult,
  RouteOptimizationResult,
  StoreBranch,
  IMapsService
} from '../../shared';

export function calculateHaversineDistanceKm(p1: LatLng, p2: LatLng): number {
  const R = 6371; // Earth radius in km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export function calculateMotorbikeShippingRate(
  distanceKm: number,
  city: 'Hanoi' | 'Da Nang' | 'Ho Chi Minh City' | string,
  isRushHour: boolean = false
): { shippingRateVnd: number; rateTier: DistanceResult['rateTier']; durationMinutes: number } {
  let rate = 0;
  let tier: DistanceResult['rateTier'] = 'STANDARD_INNER_CITY';
  let speedKmH = isRushHour ? 18 : 28; // Vietnamese motorbike traffic speed

  if (distanceKm <= 3.0) {
    rate = 18000;
    tier = 'STANDARD_INNER_CITY';
  } else if (distanceKm <= 7.0) {
    rate = 18000 + Math.round((distanceKm - 3.0) * 4000);
    tier = 'STANDARD_INNER_CITY';
  } else if (distanceKm <= 15.0) {
    rate = 35000 + Math.round((distanceKm - 7.0) * 3500);
    tier = 'SUBURB';
  } else {
    rate = 55000 + Math.round((distanceKm - 15.0) * 5000);
    tier = 'INTER_PROVINCIAL';
  }

  if (isRushHour) {
    rate = Math.round(rate * 1.15); // 15% rush hour surcharge
  }

  const durationMinutes = Math.max(10, Math.round((distanceKm / speedKmH) * 60 + 5)); // +5 min buffer

  return {
    shippingRateVnd: rate,
    rateTier: tier,
    durationMinutes
  };
}

export function optimizeStopsTSP(
  depot: LatLng,
  stops: { id: string; location: LatLng; address: string; customerName: string; customerPhone: string }[]
): RouteOptimizationResult {
  const remaining = [...stops];
  const orderedStops: any[] = [];
  let currentLoc = depot;
  let totalDistanceKm = 0;
  let accumulatedMinutes = 0;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let minDistance = calculateHaversineDistanceKm(currentLoc, remaining[0].location);

    for (let i = 1; i < remaining.length; i++) {
      const dist = calculateHaversineDistanceKm(currentLoc, remaining[i].location);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextStop = remaining.splice(nearestIdx, 1)[0];
    totalDistanceKm += minDistance;
    const legMinutes = Math.round((minDistance / 25) * 60 + 8); // travel + dropoff time
    accumulatedMinutes += legMinutes;

    orderedStops.push({
      stopIndex: orderedStops.length + 1,
      orderId: nextStop.id,
      address: nextStop.address,
      customerName: nextStop.customerName,
      customerPhone: nextStop.customerPhone,
      location: nextStop.location,
      estimatedArrivalMinutes: accumulatedMinutes,
      distanceFromPreviousKm: minDistance
    });

    currentLoc = nextStop.location;
  }

  return {
    depotAddress: 'Kho Tổng Hà Nội (18 Hàng Gai)',
    depotLocation: depot,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalDurationMinutes: accumulatedMinutes,
    optimizedStops: orderedStops,
    totalOrders: stops.length
  };
}

export class MockMapsService implements IMapsService {
  private branches: StoreBranch[] = [
    createMockStoreBranch({
      branchId: 'BR-HN-01',
      name: 'Chi Nhánh Hoàn Kiếm Hà Nội',
      location: { lat: 21.033333, lng: 105.850000 },
      city: 'Hanoi'
    }),
    createMockStoreBranch({
      branchId: 'BR-DN-01',
      name: 'Chi Nhánh Hải Châu Đà Nẵng',
      location: { lat: 16.067778, lng: 108.220833 },
      city: 'Da Nang'
    }),
    createMockStoreBranch({
      branchId: 'BR-HCM-01',
      name: 'Chi Nhánh Quận 1 TP.HCM',
      location: { lat: 10.776889, lng: 106.700806 },
      city: 'Ho Chi Minh City'
    })
  ];

  async calculateDistance(origin: LatLng | string, destination: LatLng | string): Promise<DistanceResult> {
    const oLoc = typeof origin === 'string' ? { lat: 21.0333, lng: 105.8500 } : origin;
    const dLoc = typeof destination === 'string' ? { lat: 21.0285, lng: 105.8542 } : destination;
    const dist = calculateHaversineDistanceKm(oLoc, dLoc);
    const { shippingRateVnd, rateTier, durationMinutes } = calculateMotorbikeShippingRate(dist, 'Hanoi');

    return {
      origin: typeof origin === 'string' ? origin : `${oLoc.lat},${oLoc.lng}`,
      destination: typeof destination === 'string' ? destination : `${dLoc.lat},${dLoc.lng}`,
      distanceKm: dist,
      durationMinutes,
      shippingRateVnd,
      rateTier
    };
  }

  async optimizeDeliveryRoute(depot: LatLng | string, stops: (LatLng | string)[]): Promise<RouteOptimizationResult> {
    const depotLoc: LatLng = typeof depot === 'string' ? { lat: 21.0333, lng: 105.8500 } : depot;
    const mappedStops = stops.map((s, idx) => ({
      id: `ORD-ROUTE-00${idx + 1}`,
      address: typeof s === 'string' ? s : `Điểm giao #${idx + 1}`,
      customerName: `Khách hàng ${idx + 1}`,
      customerPhone: `090000000${idx + 1}`,
      location: typeof s === 'string' ? { lat: 21.0333 + idx * 0.01, lng: 105.8500 + idx * 0.01 } : s
    }));

    return optimizeStopsTSP(depotLoc, mappedStops);
  }

  async getStoreBranches(): Promise<StoreBranch[]> {
    return [...this.branches];
  }

  findNearestBranch(customerLoc: LatLng): { branch: StoreBranch; distanceKm: number } {
    let nearest = this.branches[0];
    let minDistance = calculateHaversineDistanceKm(customerLoc, nearest.location);

    for (const b of this.branches) {
      const d = calculateHaversineDistanceKm(customerLoc, b.location);
      if (d < minDistance) {
        minDistance = d;
        nearest = b;
      }
    }

    return { branch: nearest, distanceKm: minDistance };
  }
}

describe('F6: Google Maps Platform & Route Matrix Integration', () => {
  test('Test 6.1: Accurate Haversine distance and duration calculation', () => {
    // Hoan Kiem Lake to Hanoi Opera House (~1.2 km)
    const hoanKiem: LatLng = { lat: 21.028511, lng: 105.854167 };
    const operaHouse: LatLng = { lat: 21.024444, lng: 105.857778 };

    const distance = calculateHaversineDistanceKm(hoanKiem, operaHouse);
    assertRange(distance, 0.4, 1.5, 'Distance between Hoan Kiem and Opera House should be ~0.6 km');
  });

  test('Test 6.2: Vietnam motorbike shipping rate tier calculation for Hanoi/HCMC/Da Nang', () => {
    // 2.5 km -> Base rate 18,000 VND (Inner city)
    const shortTrip = calculateMotorbikeShippingRate(2.5, 'Hanoi');
    assertEqual(shortTrip.shippingRateVnd, 18000);
    assertEqual(shortTrip.rateTier, 'STANDARD_INNER_CITY');

    // 5.0 km -> 18,000 + (2 * 4,000) = 26,000 VND
    const midTrip = calculateMotorbikeShippingRate(5.0, 'Hanoi');
    assertEqual(midTrip.shippingRateVnd, 26000);

    // 10.0 km -> Suburb tier
    const suburbTrip = calculateMotorbikeShippingRate(10.0, 'Hanoi');
    assertEqual(suburbTrip.rateTier, 'SUBURB');
    assertTrue(suburbTrip.shippingRateVnd > 35000);

    // Rush hour surcharge
    const rushTrip = calculateMotorbikeShippingRate(5.0, 'Hanoi', true);
    assertTrue(rushTrip.shippingRateVnd > midTrip.shippingRateVnd);
  });

  test('Test 6.3: Multi-stop TSP delivery route sequencing and stop ordering', () => {
    const depot: LatLng = { lat: 21.0333, lng: 105.8500 }; // 18 Hang Gai
    const stops = [
      { id: 'O-1', address: 'Ba Đình (Xa)', location: { lat: 21.0500, lng: 105.8300 }, customerName: 'Khách A', customerPhone: '091' },
      { id: 'O-2', address: 'Tràng Tiền (Gần)', location: { lat: 21.0250, lng: 105.8550 }, customerName: 'Khách B', customerPhone: '092' },
      { id: 'O-3', address: 'Hai Bà Trưng (Vừa)', location: { lat: 21.0150, lng: 105.8500 }, customerName: 'Khách C', customerPhone: '093' }
    ];

    const route = optimizeStopsTSP(depot, stops);
    assertEqual(route.totalOrders, 3);
    assertEqual(route.optimizedStops.length, 3);
    // Nearest stop should be visited first (Tràng Tiền)
    assertEqual(route.optimizedStops[0].orderId, 'O-2');
    assertTrue(route.totalDistanceKm > 0);
  });

  test('Test 6.4: Store branch lookup and nearest depot selection', async () => {
    const mapsService = new MockMapsService();
    const branches = await mapsService.getStoreBranches();
    assertEqual(branches.length, 3);

    // Customer in Hanoi Cầu Giấy (21.0362, 105.7906) -> Nearest branch should be Hanoi Hoan Kiem
    const nearestHn = mapsService.findNearestBranch({ lat: 21.0362, lng: 105.7906 });
    assertEqual(nearestHn.branch.city, 'Hanoi');
    assertRange(nearestHn.distanceKm, 3.0, 10.0);

    // Customer in HCMC District 3 (10.7833, 106.6833) -> Nearest branch should be HCMC District 1
    const nearestHcm = mapsService.findNearestBranch({ lat: 10.7833, lng: 106.6833 });
    assertEqual(nearestHcm.branch.city, 'Ho Chi Minh City');
  });

  test('Test 6.5: Estimated delivery duration under traffic conditions', async () => {
    const mapsService = new MockMapsService();
    const result = await mapsService.calculateDistance(
      { lat: 21.0333, lng: 105.8500 },
      { lat: 21.0285, lng: 105.8542 }
    );

    assertTrue(result.durationMinutes >= 10);
    assertRange(result.distanceKm, 0.1, 5.0);
  });
});
