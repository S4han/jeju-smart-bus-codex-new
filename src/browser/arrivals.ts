import type { ArrivalSnapshot } from '../ArrivalPanel';

/** Same-origin local API only. Never sends coordinates or a provider key. */
export async function requestArrivals(stationId: string, signal: AbortSignal): Promise<ArrivalSnapshot> {
  const response = await fetch('/api/arrivals', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stationId }), signal, cache: 'no-store', credentials: 'omit',
    redirect: 'error', referrerPolicy: 'no-referrer',
  });
  const unavailable = { stationId, httpStatus: response.status, resultCode: null, rows: null, mapping: [] };
  if (!response.ok) return unavailable;
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('format');
  const value = data as Record<string, unknown>;
  if (value.stationId !== stationId || value.httpStatus !== 200 || value.resultCode !== '00' ||
    !Array.isArray(value.rows) || !Array.isArray(value.mapping) ||
    !value.rows.every(row => row && typeof row === 'object' && !Array.isArray(row)) ||
    !value.mapping.every(row => row && typeof row === 'object' && typeof row.routeId === 'string' && /^\d{9}$/.test(row.routeId) &&
      typeof row.stationId === 'string' && /^\d{9}$/.test(row.stationId) && typeof row.direction === 'string' && /^\d+$/.test(row.direction) &&
      Number.isSafeInteger(row.order) && row.order > 0)) throw new Error('format');
  return data as ArrivalSnapshot;
}
