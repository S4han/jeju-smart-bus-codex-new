import { describe, expect, it } from 'vitest';
import { distanceMeters, nearbyStations } from '../src/domain/nearby';
// Synthetic great-circle boundaries, not public stop observations.
const point = { latitude: 0, longitude: 0 };
const station = (meters: number, id: string) => ({ id, name: '합성 정류장',
  latitude: meters / 6_371_008.8 * 180 / Math.PI, longitude: 0 });
describe('local radius search (AC-003)', () => {
  it('includes 450m and 500m and excludes 550m at the default radius', () => {
    const rows = [station(450, '405000001'), station(500, '405000002'), station(550, '405000003')];
    expect(nearbyStations(point, rows, 500).map(row => row.id)).toEqual(['405000001', '405000002']);
    expect(nearbyStations(point, rows, 1000)).toHaveLength(3);
  });
  it('excludes invalid coordinates and ambiguous IDs without correction', () => {
    const a = station(20, '405000001');
    expect(nearbyStations(point, [a, a, { ...station(30, '405000002'), latitude: 126 }], 500)).toEqual([]);
    expect(nearbyStations({ latitude: NaN, longitude: 0 }, [a], 500)).toEqual([]);
  });
  it('uses the unrounded distance for inclusion and stable IDs for ties', () => {
    const rows = [station(500.01, '405000003'), station(100, '405000002'), station(100, '405000001')];
    expect(nearbyStations(point, rows, 500).map(row => row.id)).toEqual(['405000001', '405000002']);
    expect(distanceMeters(point, point)).toBe(0);
  });
});
