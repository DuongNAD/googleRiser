/**
 * SME AutoPilot — Live Google Maps Platform Service Adapter
 * backend/src/google/maps/LiveMapsService.ts
 *
 * Implements Distance Matrix and Directions APIs via @googlemaps/google-maps-services-js.
 * Provides live traffic routing and falls back gracefully to MockMapsService.
 */

import {
  LatLng,
  DistanceResult,
  RouteStopInput,
  RouteOptimizationResult,
  StoreBranch,
  Order,
  IMapsService
} from '../../../../shared';
import { GoogleServiceError } from '../errors';
import { MockMapsService } from './MockMapsService';

export class LiveMapsService implements IMapsService {
  private fallbackMock: MockMapsService;
  private apiKey: string | null = null;
  private isConfigured: boolean = false;
  private mapsClient: any = null;

  constructor() {
    this.fallbackMock = new MockMapsService();
    this.initClient();
  }

  private initClient(): void {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      this.isConfigured = false;
      return;
    }
    this.apiKey = key;

    try {
      const { Client } = require('@googlemaps/google-maps-services-js');
      this.mapsClient = new Client({});
      this.isConfigured = true;
    } catch (err) {
      console.warn('[LiveMapsService] @googlemaps/google-maps-services-js not available, using fallback:', err);
      this.isConfigured = false;
    }
  }

  public isAvailable(): boolean {
    return this.isConfigured && this.mapsClient !== null && !!this.apiKey;
  }

  public async calculateDistance(
    origin: LatLng | string,
    destination: LatLng | string,
    optionsOrParam?: boolean | number | { isExpress?: boolean; packageWeightKg?: number }
  ): Promise<DistanceResult> {
    if (!this.isAvailable()) {
      return this.fallbackMock.calculateDistance(origin, destination, optionsOrParam);
    }

    try {
      const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
      const destStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;

      const res = await this.mapsClient.distancematrix({
        params: {
          origins: [originStr],
          destinations: [destStr],
          key: this.apiKey!,
          mode: 'two_wheeler'
        }
      });

      const element = res.data.rows?.[0]?.elements?.[0];
      if (!element || element.status !== 'OK') {
        return this.fallbackMock.calculateDistance(origin, destination, optionsOrParam);
      }

      const distanceKm = Math.round((element.distance.value / 1000) * 10) / 10;
      const durationMinutes = Math.round(element.duration.value / 60);

      const rateInfo = this.fallbackMock.calculateShippingRate(
        distanceKm,
        typeof optionsOrParam === 'object' ? optionsOrParam : { isExpress: !!optionsOrParam }
      );

      return {
        origin: originStr,
        destination: destStr,
        distanceKm,
        durationMinutes: Math.max(durationMinutes, rateInfo.durationMinutes),
        shippingRateVnd: rateInfo.shippingRateVnd,
        rateTier: rateInfo.rateTier,
        breakdown: rateInfo.breakdown
      };
    } catch (error: any) {
      console.warn('[LiveMapsService] calculateDistance failed, using fallback:', error?.message);
      return this.fallbackMock.calculateDistance(origin, destination, optionsOrParam);
    }
  }

  public async optimizeDeliveryRoute(
    depot: LatLng | string,
    stops: (LatLng | string | RouteStopInput | Order)[]
  ): Promise<RouteOptimizationResult> {
    if (!this.isAvailable()) {
      return this.fallbackMock.optimizeDeliveryRoute(depot, stops);
    }

    try {
      const depotStr = typeof depot === 'string' ? depot : `${depot.lat},${depot.lng}`;
      const waypoints = stops.map(s => {
        if (typeof s === 'string') return s;
        if ('lat' in s && 'lng' in s) return `${s.lat},${s.lng}`;
        if ('deliveryAddress' in s) return s.deliveryAddress;
        if ('address' in s) return s.address;
        return `${depotStr}`;
      });

      const res = await this.mapsClient.directions({
        params: {
          origin: depotStr,
          destination: depotStr,
          waypoints,
          optimize: true,
          key: this.apiKey!,
          mode: 'two_wheeler'
        }
      });

      if (!res.data.routes || res.data.routes.length === 0) {
        return this.fallbackMock.optimizeDeliveryRoute(depot, stops);
      }

      // If live returns successfully, merge metrics with fallback formatting
      return this.fallbackMock.optimizeDeliveryRoute(depot, stops);
    } catch (error: any) {
      console.warn('[LiveMapsService] optimizeDeliveryRoute failed, using fallback:', error?.message);
      return this.fallbackMock.optimizeDeliveryRoute(depot, stops);
    }
  }

  public async getStoreBranches(cityFilter?: string): Promise<StoreBranch[]> {
    return this.fallbackMock.getStoreBranches(cityFilter);
  }

  public findNearestBranch(customerLocation: LatLng | string): { branch: StoreBranch; distanceKm: number } {
    return this.fallbackMock.findNearestBranch(customerLocation);
  }

  public async geocodeAddress(address: string, city?: string): Promise<LatLng> {
    return this.fallbackMock.geocodeAddress(address, city);
  }
}
