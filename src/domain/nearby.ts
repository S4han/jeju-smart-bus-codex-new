import type { LocalPoint } from './location';

export interface NearbyStation { id: string; name: string; latitude: number; longitude: number }
export interface NearbyResult extends NearbyStation { distanceMeters: number }
const EARTH_RADIUS_METERS = 6_371_008.8;
const radians = (degrees: number) => degrees * Math.PI / 180;
function valid(point: LocalPoint): boolean {
  return Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}
/** Straight-line great-circle distance, never a walking distance or time. */
export function distanceMeters(a: LocalPoint, b: LocalPoint): number {
  if (!valid(a) || !valid(b)) return NaN;
  const lat = radians(b.latitude - a.latitude), lon = radians(b.longitude - a.longitude);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
/** Callers may expand only after an empty 500m result and explicit consent for that point. */
export function nearbyStations(point: LocalPoint, stations: readonly NearbyStation[], radius: 500 | 1000): NearbyResult[] {
  if (!valid(point)) return [];
  const counts = new Map<string, number>();
  for (const station of stations) counts.set(station.id, (counts.get(station.id) ?? 0) + 1);
  return stations.flatMap(station => {
    if (counts.get(station.id) !== 1 || !/^\d{9}$/.test(station.id) || !station.name.trim()) return [];
    const distance = distanceMeters(point, station);
    return distance <= radius ? [{ ...station, distanceMeters: distance }] : [];
  }).sort((a, b) => a.distanceMeters - b.distanceMeters || a.id.localeCompare(b.id));
}
