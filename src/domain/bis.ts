import type { DataResult } from './result';

type Row = Readonly<Record<string, unknown>>;
const idPattern = /^\d{9}$/;
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s === '' || s === 'null' ? null : s;
}
function numeric(value: unknown): number | null {
  const s = text(value);
  // Provider values are decimal text; Number alone also accepts hex/binary literals.
  if (s === null || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function id(value: unknown): string | null {
  const s = text(value);
  return s !== null && idPattern.test(s) ? s : null;
}
export interface Station {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'unknown';
  /** Numeric geographic range only; the actual CRS remains unverified. */
  coordinates: { longitude: number; latitude: number; crs: 'unverified' } | null;
}
export function parseStation(row: Row): DataResult<Station> {
  const stationId = id(row.stationId);
  const name = text(row.stationNm);
  if (stationId === null || name === null) return { status: 'error', kind: 'format' };
  const longitude = numeric(row.localX);
  const latitude = numeric(row.localY);
  const valid = longitude !== null && latitude !== null && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90;
  return { status: 'ok', data: {
    id: stationId, name,
    status: row.useYn === 'Y' ? 'active' : row.useYn === 'N' ? 'inactive' : 'unknown',
    coordinates: valid ? { longitude, latitude, crs: 'unverified' } : null,
  } };
}
export interface StopEvent { routeId: string; stationId: string; order: number; direction: string }
export function parseStopEvent(row: Row): DataResult<StopEvent> {
  if (row.useYn === 'N') return { status: 'empty' };
  if (row.useYn !== 'Y') return { status: 'unverified', reason: 'policy' };
  const routeId = id(row.routeId), stationId = id(row.stationId);
  const order = numeric(row.stationOrd), direction = text(row.updnDir);
  if (routeId === null || stationId === null || order === null || !Number.isSafeInteger(order) || order < 1 || direction === null)
    return { status: 'error', kind: 'format' };
  return { status: 'ok', data: { routeId, stationId, order, direction } };
}
/** No network or XML parser: accepts rows only after a trusted transport/parser boundary. */
export function matchStop(event: StopEvent, requestedStationId: string): DataResult<StopEvent> {
  return event.stationId === requestedStationId ? { status: 'ok', data: event } : { status: 'mismatch' };
}
type ObservationResult = Extract<DataResult<number>, { status: 'ok' | 'stale' | 'unverified' }>;
export function classifyObservation(timestamp: string | null, nowMs: number, maxAgeMs: number | null): ObservationResult {
  if (timestamp === null || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp))
    return { status: 'unverified', reason: 'timestamp' };
  const parts = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (parts === null) return { status: 'unverified', reason: 'timestamp' };
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined || second === undefined ||
      month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
      hour > 23 || minute > 59 || second > 59)
    return { status: 'unverified', reason: 'timestamp' };
  const observed = Date.parse(timestamp);
  if (!Number.isFinite(observed) || !Number.isFinite(nowMs) || observed > nowMs)
    return { status: 'unverified', reason: 'timestamp' };
  if (maxAgeMs === null || !Number.isFinite(maxAgeMs) || maxAgeMs < 0)
    return { status: 'unverified', reason: 'policy' };
  const age = nowMs - observed;
  return age > maxAgeMs ? { status: 'stale', observedAt: timestamp } : { status: 'ok', data: age };
}
