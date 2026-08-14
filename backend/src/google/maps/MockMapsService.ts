/**
 * SME AutoPilot — In-Memory Stateful Mock Google Maps Platform Engine
 * backend/src/google/maps/MockMapsService.ts
 *
 * Implements:
 * - Geodesic Haversine Distance Engine with 1.35x Vietnamese urban motorbike tortuosity multiplier
 * - 4-Tier Vietnamese Motorbike Shipping Rate Calculator (Inner City, Suburb, Inter-Provincial, Rush Hour Surge)
 * - Multi-stop TSP 2-Opt heuristic delivery route optimizer
 * - Knowledge base geocoding for Vietnamese districts in Hanoi, Da Nang, and Ho Chi Minh City
 * - Store Branch Locator & Nearest Depot Resolver
 */

import {
  LatLng,
  DistanceResult,
  RouteStopInput,
  OptimizedRouteStop,
  RouteOptimizationResult,
  StoreBranch,
  VietnamShippingTier,
  Order,
  IMapsService
} from '../../../../shared';
import { RouteOptimizationError } from '../errors';
import { getStoreBranches, DEFAULT_STORE_BRANCHES } from '../../seed';

export const VIETNAM_DISTRICT_COORDINATES: Record<string, LatLng> = {
  // Hanoi
  'hoan kiem': { lat: 21.028511, lng: 105.854167 },
  'ba dinh': { lat: 21.0341, lng: 105.8244 },
  'cau giay': { lat: 21.0362, lng: 105.7906 },
  'dong da': { lat: 21.0181, lng: 105.8299 },
  'hai ba trung': { lat: 21.0069, lng: 105.8524 },
  'ha dong': { lat: 20.9723, lng: 105.7772 },
  'tay ho': { lat: 21.0722, lng: 105.8211 },
  'thanh xuan': { lat: 20.9937, lng: 105.8114 },
  'nam tu liem': { lat: 21.0167, lng: 105.7667 },
  'bac tu liem': { lat: 21.0667, lng: 105.7667 },
  'long bien': { lat: 21.0333, lng: 105.8833 },
  'trang tien': { lat: 21.024444, lng: 105.857778 },
  'hang gai': { lat: 21.033333, lng: 105.850000 },
  'pho hue': { lat: 21.0185, lng: 105.8520 },

  // Da Nang
  'hai chau': { lat: 16.0680, lng: 108.2208 },
  'son tra': { lat: 16.0820, lng: 108.2435 },
  'thanh khe': { lat: 16.0617, lng: 108.1822 },
  'ngu hanh son': { lat: 16.0125, lng: 108.2473 },
  'cam le': { lat: 15.9983, lng: 108.1969 },
  'lien chieu': { lat: 16.0833, lng: 108.1500 },
  'nguyen van linh': { lat: 16.067778, lng: 108.220833 },

  // Ho Chi Minh City
  'quan 1': { lat: 10.7769, lng: 106.7009 },
  'district 1': { lat: 10.7769, lng: 106.7009 },
  'quan 3': { lat: 10.7844, lng: 106.6842 },
  'district 3': { lat: 10.7844, lng: 106.6842 },
  'quan 5': { lat: 10.7554, lng: 106.6789 },
  'district 5': { lat: 10.7554, lng: 106.6789 },
  'quan 7': { lat: 10.7340, lng: 106.7218 },
  'district 7': { lat: 10.7340, lng: 106.7218 },
  'binh thanh': { lat: 10.8106, lng: 106.7091 },
  'tan binh': { lat: 10.8015, lng: 106.6558 },
  'thu duc': { lat: 10.8494, lng: 106.7537 },
  'phu nhuan': { lat: 10.7992, lng: 106.6806 },
  'go vap': { lat: 10.8386, lng: 106.6653 }
};

export class MockMapsService implements IMapsService {
  private branches: StoreBranch[] = [];

  constructor(initialBranches?: StoreBranch[]) {
    this.branches = initialBranches && initialBranches.length > 0 ? [...initialBranches] : getStoreBranches();
  }

  public reset(): void {
    this.branches = getStoreBranches();
  }

  /**
   * Geodesic distance calculation via Haversine formula
   */
  public calculateGeodesicDistanceKm(loc1: LatLng, loc2: LatLng): number {
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
    return R * c;
  }

  /**
   * Actual motorbike travel distance applying 1.35x urban winding multiplier
   */
  public calculateUrbanDistanceKm(loc1: LatLng, loc2: LatLng, tortuosity: number = 1.35): number {
    const straight = this.calculateGeodesicDistanceKm(loc1, loc2);
    if (straight < 0.05) return 0.1;
    return Math.round(straight * tortuosity * 10) / 10;
  }

  /**
   * Geocoding simulation from address strings to LatLng coordinates
   */
  public geocodeAddressSync(address: string, city: string = 'Hanoi'): LatLng {
    const text = address.toLowerCase();

    // Check district map (sort by key length descending to prioritize specific multi-word districts)
    const sortedDistricts = Object.entries(VIETNAM_DISTRICT_COORDINATES).sort((a, b) => b[0].length - a[0].length);
    for (const [key, coords] of sortedDistricts) {
      if (text.includes(key)) {
        return coords;
      }
    }

    // Default city fallbacks
    if (text.includes('hồ chí minh') || text.includes('hcm') || text.includes('sài gòn') || city.toLowerCase().includes('ho chi minh')) {
      return VIETNAM_DISTRICT_COORDINATES['quan 1'];
    }
    if (text.includes('đà nẵng') || text.includes('da nang') || city.toLowerCase().includes('da nang')) {
      return VIETNAM_DISTRICT_COORDINATES['hai chau'];
    }

    return VIETNAM_DISTRICT_COORDINATES['hoan kiem'];
  }

  public async geocodeAddress(address: string, city?: string): Promise<LatLng> {
    return this.geocodeAddressSync(address, city);
  }

  public async geocode(address: string): Promise<LatLng> {
    return this.geocodeAddressSync(address);
  }

  private parseLocation(input: LatLng | string): LatLng {
    if (typeof input === 'object' && typeof input.lat === 'number' && typeof input.lng === 'number') {
      return input;
    }
    if (typeof input === 'string') {
      const parts = input.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { lat: parts[0], lng: parts[1] };
      }
      return this.geocodeAddressSync(input);
    }
    return { lat: 21.028511, lng: 105.854167 };
  }

  /**
   * 4-Tier Vietnamese Motorbike Shipping Rate Calculator
   */
  public calculateShippingRate(
    distanceKm: number,
    options?: { isRushHour?: boolean; isExpress?: boolean; packageWeightKg?: number }
  ): {
    shippingRateVnd: number;
    rateTier: VietnamShippingTier;
    durationMinutes: number;
    breakdown: { baseRateVnd: number; extraDistanceRateVnd: number; peakHourSurchargeVnd: number };
  } {
    let baseRateVnd = 18000;
    let extraDistanceRateVnd = 0;
    let rateTier: VietnamShippingTier = 'STANDARD_INNER_CITY';

    if (distanceKm <= 3.0) {
      rateTier = 'STANDARD_INNER_CITY';
      extraDistanceRateVnd = 0;
    } else if (distanceKm <= 7.0) {
      rateTier = 'STANDARD_INNER_CITY';
      extraDistanceRateVnd = Math.round((distanceKm - 3.0) * 4000);
    } else if (distanceKm <= 15.0) {
      rateTier = 'SUBURB';
      baseRateVnd = 35000;
      extraDistanceRateVnd = Math.round((distanceKm - 7.0) * 3500);
    } else {
      rateTier = 'INTER_PROVINCIAL';
      baseRateVnd = 55000;
      extraDistanceRateVnd = Math.round((distanceKm - 15.0) * 5000);
    }

    let subtotal = baseRateVnd + extraDistanceRateVnd;
    let peakHourSurchargeVnd = 0;

    const isPeak = options?.isRushHour || options?.isExpress;
    if (isPeak) {
      peakHourSurchargeVnd = Math.round(subtotal * 0.15); // 15% peak surcharge
      if (options?.isExpress) {
        rateTier = 'EXPRESS';
      }
    }

    const totalShipping = subtotal + peakHourSurchargeVnd;
    const speedKmH = isPeak ? 18 : 28;
    const durationMinutes = Math.max(10, Math.round((distanceKm / speedKmH) * 60 + 5));

    return {
      shippingRateVnd: totalShipping,
      rateTier,
      durationMinutes,
      breakdown: {
        baseRateVnd,
        extraDistanceRateVnd,
        peakHourSurchargeVnd
      }
    };
  }

  public async calculateDistance(
    origin: LatLng | string,
    destination: LatLng | string,
    optionsOrParam?: boolean | number | { isExpress?: boolean; packageWeightKg?: number }
  ): Promise<DistanceResult> {
    const oLoc = this.parseLocation(origin);
    const dLoc = this.parseLocation(destination);
    const distanceKm = this.calculateUrbanDistanceKm(oLoc, dLoc);

    let isExpress = false;
    let packageWeightKg = 1;

    if (typeof optionsOrParam === 'boolean') {
      isExpress = optionsOrParam;
    } else if (typeof optionsOrParam === 'number') {
      packageWeightKg = optionsOrParam;
    } else if (typeof optionsOrParam === 'object' && optionsOrParam !== null) {
      isExpress = !!optionsOrParam.isExpress;
      if (optionsOrParam.packageWeightKg) packageWeightKg = optionsOrParam.packageWeightKg;
    }

    const rateInfo = this.calculateShippingRate(distanceKm, { isExpress, packageWeightKg });

    return {
      origin: typeof origin === 'string' ? origin : `${oLoc.lat},${oLoc.lng}`,
      originLocation: oLoc,
      destination: typeof destination === 'string' ? destination : `${dLoc.lat},${dLoc.lng}`,
      destinationLocation: dLoc,
      distanceKm,
      durationMinutes: rateInfo.durationMinutes,
      shippingRateVnd: rateInfo.shippingRateVnd,
      rateTier: rateInfo.rateTier,
      breakdown: rateInfo.breakdown
    };
  }

  /**
   * Multi-Stop Delivery Route Optimizer using 2-Opt Local Search
   */
  public async optimizeDeliveryRoute(
    depot: LatLng | string,
    stops: (LatLng | string | RouteStopInput | Order)[]
  ): Promise<RouteOptimizationResult> {
    if (!stops || stops.length === 0) {
      throw new RouteOptimizationError('At least 1 stop is required for route optimization', 0);
    }

    const depotLoc = this.parseLocation(depot);

    // Normalize stops
    const normalizedStops = stops.map((s: any, idx: number) => {
      if (typeof s === 'string') {
        const loc = this.geocodeAddressSync(s);
        return {
          orderId: `ORD-ROUTE-00${idx + 1}`,
          address: s,
          customerName: `Khách hàng ${idx + 1}`,
          customerPhone: `090000000${idx + 1}`,
          location: loc
        };
      }
      if (s.id || s.orderId || s.customerName || s.deliveryAddress) {
        const addr = s.deliveryAddress || s.address || `Điểm giao #${idx + 1}`;
        const loc = s.location || this.geocodeAddressSync(addr, s.city);
        return {
          orderId: s.id || s.orderId || `ORD-ROUTE-00${idx + 1}`,
          address: addr,
          customerName: s.customerName || `Khách hàng ${idx + 1}`,
          customerPhone: s.customerPhone || `090000000${idx + 1}`,
          district: s.district,
          location: loc
        };
      }
      if (typeof s.lat === 'number' && typeof s.lng === 'number') {
        return {
          orderId: `ORD-ROUTE-00${idx + 1}`,
          address: `Tọa độ (${s.lat}, ${s.lng})`,
          customerName: `Khách hàng ${idx + 1}`,
          customerPhone: `090000000${idx + 1}`,
          location: s
        };
      }
      return {
        orderId: `ORD-ROUTE-00${idx + 1}`,
        address: `Điểm giao #${idx + 1}`,
        customerName: `Khách hàng ${idx + 1}`,
        customerPhone: `090000000${idx + 1}`,
        location: { lat: 21.0333 + idx * 0.01, lng: 105.8500 + idx * 0.01 }
      };
    });

    // 1. Initial Nearest Neighbor Tour
    const remaining = [...normalizedStops];
    const ordered: any[] = [];
    let currentLoc = depotLoc;

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minDistance = this.calculateUrbanDistanceKm(currentLoc, remaining[0].location);

      for (let i = 1; i < remaining.length; i++) {
        const d = this.calculateUrbanDistanceKm(currentLoc, remaining[i].location);
        if (d < minDistance) {
          minDistance = d;
          nearestIdx = i;
        }
      }

      const next = remaining.splice(nearestIdx, 1)[0];
      ordered.push(next);
      currentLoc = next.location;
    }

    // 2. 2-Opt Local Search Improvement
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 50 && ordered.length > 3) {
      improved = false;
      iterations++;
      for (let i = 0; i < ordered.length - 1; i++) {
        for (let k = i + 1; k < ordered.length; k++) {
          const prevA = i === 0 ? depotLoc : ordered[i - 1].location;
          const currA = ordered[i].location;
          const currB = ordered[k].location;
          const nextB = k === ordered.length - 1 ? depotLoc : ordered[k + 1].location;

          const currentDist =
            this.calculateUrbanDistanceKm(prevA, currA) + this.calculateUrbanDistanceKm(currB, nextB);
          const newDist =
            this.calculateUrbanDistanceKm(prevA, currB) + this.calculateUrbanDistanceKm(currA, nextB);

          if (newDist < currentDist - 0.01) {
            // Reverse sub-segment [i..k]
            const segment = ordered.slice(i, k + 1).reverse();
            ordered.splice(i, segment.length, ...segment);
            improved = true;
          }
        }
      }
    }

    // 3. Compute arrival times and cumulative metrics
    let totalDistanceKm = 0;
    let accumulatedMinutes = 0;
    let prevLoc = depotLoc;

    const optimizedStops: OptimizedRouteStop[] = ordered.map((stop, idx) => {
      const legDist = this.calculateUrbanDistanceKm(prevLoc, stop.location);
      totalDistanceKm += legDist;
      const legDuration = Math.max(5, Math.round((legDist / 25) * 60 + 8)); // 25 km/h + 8 min handover
      accumulatedMinutes += legDuration;
      prevLoc = stop.location;

      return {
        stopIndex: idx + 1,
        orderId: stop.orderId,
        address: stop.address,
        customerName: stop.customerName,
        customerPhone: stop.customerPhone,
        district: stop.district,
        location: stop.location,
        estimatedArrivalMinutes: accumulatedMinutes,
        distanceFromPreviousKm: legDist,
        cumulativeDistanceKm: Math.round(totalDistanceKm * 10) / 10
      };
    });

    return {
      depotAddress: typeof depot === 'string' ? depot : 'Kho Tổng (Hà Nội)',
      depotLocation: depotLoc,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalDurationMinutes: accumulatedMinutes,
      optimizedStops,
      totalOrders: stops.length,
      efficiencyGainPercent: Math.min(35, Math.round((1 - totalDistanceKm / (totalDistanceKm * 1.25)) * 100))
    };
  }

  public async getStoreBranches(cityFilter?: string): Promise<StoreBranch[]> {
    if (cityFilter) {
      return this.branches.filter(b => b.city.toLowerCase() === cityFilter.toLowerCase());
    }
    return [...this.branches];
  }

  public findNearestBranch(customerLocation: LatLng | string): { branch: StoreBranch; distanceKm: number } {
    const loc = this.parseLocation(customerLocation);
    let nearest = this.branches[0];
    let minDistance = this.calculateUrbanDistanceKm(loc, nearest.location);

    for (const b of this.branches) {
      const dist = this.calculateUrbanDistanceKm(loc, b.location);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = b;
      }
    }

    return { branch: nearest, distanceKm: minDistance };
  }
}
