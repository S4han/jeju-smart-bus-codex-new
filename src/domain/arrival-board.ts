import { classifyResponse, validateArrival, type Arrival } from './arrivals';
import type { StopEvent } from './bis';

type Row = Readonly<Record<string, unknown>>;
/** User approved 2026-10-28 after two live samples; not a provider update SLA. */
export const APPROVED_ARRIVAL_MAX_AGE_MS = 60_000;
export interface ArrivalExclusions {
  stale: number;
  unverified: number;
  invalid: number;
  mismatch: number;
  duplicate: number;
}
export type ArrivalBoard =
  | { status: 'empty'; stationId: string }
  | { status: 'unavailable'; reason: 'network' | 'format' | 'upstream' | 'quota' | 'policy' }
  | { status: 'checked'; stationId: string; arrivals: readonly Arrival[]; excluded: ArrivalExclusions };

/** Pure decoded-response boundary. No lookup, retry or invented fallback times. */
export function buildArrivalBoard(input: {
  stationId: string;
  httpStatus: number;
  resultCode: unknown;
  rows: readonly Row[] | null;
  mapping: readonly StopEvent[];
  nowMs: number;
  maxAgeMs?: number | null;
}): ArrivalBoard {
  if (!/^\d{9}$/.test(input.stationId) || !Number.isFinite(input.nowMs))
    return { status: 'unavailable', reason: 'format' };
  const response = classifyResponse(input.httpStatus, input.resultCode, input.rows);
  if (response.status === 'quota') return { status: 'unavailable', reason: 'quota' };
  if (response.status === 'error') return { status: 'unavailable', reason: response.kind };
  if (response.status === 'empty') return { status: 'empty', stationId: input.stationId };
  if (response.status !== 'ok') return { status: 'unavailable', reason: 'format' };
  const maxAgeMs = input.maxAgeMs === undefined ? APPROVED_ARRIVAL_MAX_AGE_MS : input.maxAgeMs;
  if (maxAgeMs === null || !Number.isFinite(maxAgeMs) || maxAgeMs < 0)
    return { status: 'unavailable', reason: 'policy' };

  const excluded: ArrivalExclusions = { stale: 0, unverified: 0, invalid: 0, mismatch: 0, duplicate: 0 };
  const arrivals: Arrival[] = [];
  // A repeated vehicle/stop identity may carry conflicting predictions: exclude the group.
  const counts = new Map<string, number>();
  const identity = (row: Row) => JSON.stringify(
    [row.routeId, row.stationOrd, row.updnDir, row.arrvVhId].map(value => typeof value === 'string' ? value : null),
  );
  for (const row of response.data) {
    const key = identity(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const row of response.data) {
    if ((counts.get(identity(row)) ?? 0) > 1) { excluded.duplicate++; continue; }
    const result = validateArrival(row, input.stationId, input.mapping, input.nowMs, maxAgeMs);
    if (result.status === 'ok') arrivals.push(result.data);
    else if (result.status === 'stale') excluded.stale++;
    else if (result.status === 'mismatch') excluded.mismatch++;
    else if (result.status === 'unverified') excluded.unverified++;
    else excluded.invalid++;
  }
  return { status: 'checked', stationId: input.stationId, arrivals, excluded };
}
