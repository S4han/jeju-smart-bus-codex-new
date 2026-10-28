import { classifyObservation, type StopEvent } from './bis';
import type { DataResult } from './result';

export interface Arrival {
  routeId: string;
  order: number;
  direction: string;
  observedAt: string;
  predictedMinutes: number;
  remainingStops: number;
}
function integer(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}
/** Pure boundary; a result is usable only with verified mapping and explicit age policy. */
export function validateArrival(
  row: Readonly<Record<string, unknown>>,
  requestedStationId: string,
  mapping: readonly StopEvent[],
  nowMs: number,
  maxAgeMs: number | null,
): DataResult<Arrival> {
  const order = integer(row.stationOrd);
  const minutes = integer(row.predictTravTm);
  const stops = integer(row.leftStation);
  if (typeof row.routeId !== 'string' || !/^\d{9}$/.test(row.routeId) ||
      typeof row.updnDir !== 'string' || !/^\d+$/.test(row.updnDir) ||
      order === null || order < 1 || minutes === null || stops === null)
    return { status: 'error', kind: 'format' };
  // Zero vehicle ID has not been validated as an operating vehicle.
  if (typeof row.arrvVhId !== 'string' || !/^\d+$/.test(row.arrvVhId) || /^0+$/.test(row.arrvVhId))
    return { status: 'unverified', reason: 'mapping' };
  const candidates = mapping.filter(e => e.routeId === row.routeId && e.direction === row.updnDir && e.order === order);
  if (candidates.length === 0) return { status: 'unverified', reason: 'mapping' };
  if (candidates.length !== 1 || candidates[0]?.stationId !== requestedStationId) return { status: 'mismatch' };
  const observedAt = typeof row.calcDate === 'string' ? row.calcDate : null;
  const age = classifyObservation(observedAt, nowMs, maxAgeMs);
  if (age.status !== 'ok') return age;
  // classifyObservation guarantees a valid timestamp in the ok branch.
  return { status: 'ok', data: { routeId:row.routeId, order, direction:row.updnDir,
    observedAt: observedAt!, predictedMinutes:minutes, remainingStops:stops } };
}

/** Classifies a completed, decoded response; HTTP status never overrides service errors. */
export function classifyResponse<T>(httpStatus: number, resultCode: unknown, rows: readonly T[] | null): DataResult<readonly T[]> {
  if (httpStatus === 429) return { status:'quota' };
  if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 300)
    return { status:'error', kind:'network' };
  if (typeof resultCode !== 'string') return { status:'error', kind:'format' };
  // No unobserved provider code is assumed to mean quota exhaustion.
  if (resultCode !== '00') return { status:'error', kind:'upstream' };
  if (rows === null) return { status:'error', kind:'format' };
  return rows.length === 0 ? { status:'empty' } : { status:'ok', data:rows };
}
