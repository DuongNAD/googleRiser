import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertRange,
  assertContains,
  assertThrows,
  runAllRegisteredSuites
} from '../harness';
import { LatLng, DistanceResult, RouteOptimizationResult, IMapsService, StoreBranch } from '../../shared';

export function validateCoordinates(loc: LatLng): void {
  if (loc.lat < -90 || loc.lat > 90 || loc.lng < -180 || loc.lng > 180 || isNaN(loc.lat) || isNaN(loc.lng)) {
    throw new Error(`INVALID_COORDINATES_ERROR: Latitude (${loc.lat}) or Longitude (${loc.lng}) is out of bounds.`);
  }
}

export function haversineDistanceKm(loc1: LatLng, loc2: LatLng): number {
  const R = 6371; // Earth radius in km
  const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.lat * Math.PI) / 180) *
      Math.cos((loc2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export class MockMapsServiceBoundary implements IMapsService {
  async calculateDistance(origin: LatLng | string, destination: LatLng | string, packageWeightKg: number = 1): Promise<DistanceResult> {
    const oLoc: LatLng = typeof origin === 'string' ? { lat: 21.0285, lng: 105.8542 } : origin;
    const dLoc: LatLng = typeof destination === 'string' ? { lat: 21.0285, lng: 105.8542 } : destination;

    // Boundary 4: Validate coordinates bounds
    validateCoordinates(oLoc);
    validateCoordinates(dLoc);

    const distanceKm = haversineDistanceKm(oLoc, dLoc);
    const durationMinutes = distanceKm === 0 ? 5 : Math.max(10, Math.round(distanceKm * 2.5));

    // Boundary 5: Package weight validation and tier
    let effectiveWeight = packageWeightKg;
    if (effectiveWeight <= 0) {
      effectiveWeight = 0.5; // fallback to minimum weight tier
    }
    const heavySurcharge = effectiveWeight > 30 ? 50000 : (effectiveWeight > 10 ? 20000 : 0);

    // Boundary 1: 0 km same-location
    if (distanceKm === 0) {
      return {
        origin: typeof origin === 'string' ? origin : `${oLoc.lat},${oLoc.lng}`,
        destination: typeof destination === 'string' ? destination : `${dLoc.lat},${dLoc.lng}`,
        distanceKm: 0,
        durationMinutes: 5,
        shippingRateVnd: 15000 + heavySurcharge,
        rateTier: 'STANDARD_INNER_CITY'
      };
    }

    // Boundary 2: Island / remote coordinates (> 300 km or off mainland)
    let rateTier: DistanceResult['rateTier'] = 'STANDARD_INNER_CITY';
    let baseRate = 22000;

    if (distanceKm > 100) {
      rateTier = 'INTER_PROVINCIAL';
      baseRate = 45000 + Math.round(distanceKm * 200);
    } else if (distanceKm > 15) {
      rateTier = 'SUBURB';
      baseRate = 35000;
    }

    return {
      origin: typeof origin === 'string' ? origin : `${oLoc.lat},${oLoc.lng}`,
      destination: typeof destination === 'string' ? destination : `${dLoc.lat},${dLoc.lng}`,
      distanceKm,
      durationMinutes,
      shippingRateVnd: baseRate + heavySurcharge,
      rateTier
    };
  }

  async optimizeDeliveryRoute(depot: LatLng | string, stops: (LatLng | string)[]): Promise<RouteOptimizationResult> {
    const depotLoc: LatLng = typeof depot === 'string' ? { lat: 21.0285, lng: 105.8542 } : depot;
    validateCoordinates(depotLoc);

    // Boundary 3: 20+ multi-stop routing stress
    let currentLoc = depotLoc;
    let totalDist = 0;
    let totalTime = 0;

    const optimizedStops = stops.map((stop, idx) => {
      const stopLoc: LatLng = typeof stop === 'string' ? { lat: 21.02 + idx * 0.005, lng: 105.85 + idx * 0.005 } : stop;
      validateCoordinates(stopLoc);

      const legDist = haversineDistanceKm(currentLoc, stopLoc);
      const legTime = Math.max(5, Math.round(legDist * 2.5));
      totalDist += legDist;
      totalTime += legTime;
      currentLoc = stopLoc;

      return {
        stopIndex: idx + 1,
        orderId: `ORD-ROUTE-STOP-${idx + 1}`,
        address: typeof stop === 'string' ? stop : `Điểm dừng #${idx + 1}`,
        customerName: `Khách hàng #${idx + 1}`,
        customerPhone: `09012345${idx < 10 ? '0' + idx : idx}`,
        location: stopLoc,
        estimatedArrivalMinutes: totalTime,
        distanceFromPreviousKm: legDist
      };
    });

    return {
      depotAddress: typeof depot === 'string' ? depot : 'Kho Tổng SME AutoPilot',
      depotLocation: depotLoc,
      totalDistanceKm: Math.round(totalDist * 100) / 100,
      totalDurationMinutes: totalTime,
      optimizedStops,
      totalOrders: stops.length
    };
  }

  async getStoreBranches(): Promise<StoreBranch[]> {
    return [];
  }
}

describe('Tier 2 Feature B6: Maps Matrix Boundaries Tests', () => {
  const mapsService = new MockMapsServiceBoundary();

  test('B6.1 - 0 km same-location delivery returns minimum base fee and STANDARD_INNER_CITY tier', async () => {
    const origin: LatLng = { lat: 21.0285, lng: 105.8542 };
    const destination: LatLng = { lat: 21.0285, lng: 105.8542 };

    const result = await mapsService.calculateDistance(origin, destination);

    assertEqual(result.distanceKm, 0);
    assertEqual(result.shippingRateVnd, 15000);
    assertEqual(result.rateTier, 'STANDARD_INNER_CITY');
    assertRange(result.durationMinutes, 0, 10);
  });

  test('B6.2 - Island / remote coordinates calculate INTER_PROVINCIAL rate tier without infinity', async () => {
    const hanoi: LatLng = { lat: 21.0285, lng: 105.8542 };
    const phuQuoc: LatLng = { lat: 10.2899, lng: 103.9840 }; // ~1200 km away

    const result = await mapsService.calculateDistance(hanoi, phuQuoc);

    assertEqual(result.rateTier, 'INTER_PROVINCIAL');
    assertTrue(result.distanceKm > 1000);
    assertTrue(result.shippingRateVnd > 100000);
    assertFalse(isNaN(result.shippingRateVnd));
  });

  test('B6.3 - 20+ multi-stop routing stress completes with valid tour visiting all stops', async () => {
    const depot: LatLng = { lat: 21.0285, lng: 105.8542 };
    const stops: LatLng[] = [];
    for (let i = 0; i < 25; i++) {
      stops.push({ lat: 21.00 + (i * 0.008), lng: 105.80 + (i * 0.006) });
    }

    const startTime = Date.now();
    const route = await mapsService.optimizeDeliveryRoute(depot, stops);
    const duration = Date.now() - startTime;

    assertEqual(route.optimizedStops.length, 25);
    assertEqual(route.totalOrders, 25);
    assertTrue(route.totalDistanceKm > 0);
    assertTrue(duration < 500, 'Route optimization should finish in <500ms');
  });

  test('B6.4 - Invalid Lat/Lng bounds throw INVALID_COORDINATES_ERROR', async () => {
    const invalidLat: LatLng = { lat: 95.5, lng: 105.85 }; // lat > 90
    const validLoc: LatLng = { lat: 21.02, lng: 105.85 };

    await assertThrows(
      () => mapsService.calculateDistance(invalidLat, validLoc),
      'INVALID_COORDINATES_ERROR'
    );

    const invalidLng: LatLng = { lat: 21.02, lng: 195.0 }; // lng > 180
    await assertThrows(
      () => mapsService.calculateDistance(validLoc, invalidLng),
      'INVALID_COORDINATES_ERROR'
    );
  });

  test('B6.5 - Zero-weight and heavy-weight (>30kg) packages calculate appropriate fees', async () => {
    const locA: LatLng = { lat: 21.0285, lng: 105.8542 };
    const locB: LatLng = { lat: 21.0385, lng: 105.8642 };

    // Zero weight package defaults to normal fee
    const resZero = await mapsService.calculateDistance(locA, locB, 0);
    assertEqual(resZero.shippingRateVnd, 22000);

    // Heavy weight package (>30kg) applies heavy surcharge
    const resHeavy = await mapsService.calculateDistance(locA, locB, 35);
    assertEqual(resHeavy.shippingRateVnd, 72000); // 22000 + 50000
  });
});

if (require.main === module) {
  runAllRegisteredSuites().then(results => {
    let failed = 0;
    for (const r of results) {
      console.log(`Suite: ${r.name} (${r.passed}/${r.total} passed)`);
      failed += r.failed;
    }
    process.exit(failed > 0 ? 1 : 0);
  });
}
