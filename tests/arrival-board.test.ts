import { describe, expect, it } from 'vitest';
import { APPROVED_ARRIVAL_MAX_AGE_MS, buildArrivalBoard } from '../src/domain/arrival-board';

// Synthetic boundaries. The approved 60-second app policy is not a provider guarantee.
const nowMs = Date.parse('2026-10-28T21:41:28+09:00');
const stationId = '406000001';
const mapping = [{ routeId: '405000001', stationId, order: 24, direction: '0' }];
const row = { routeId: '405000001', stationOrd: '24', updnDir: '0', arrvVhId: '123',
  predictTravTm: '20', leftStation: '17', calcDate: '2026-10-28T21:40:49+09:00' };
const base = { stationId, httpStatus: 200, resultCode: '00', rows: [row], mapping, nowMs, maxAgeMs: 60_000 };
describe('station arrival board (AC-005/014, NFR-004)', () => {
  it('uses the user-approved 60-second policy by default, while explicit null disables use', () => {
    expect(APPROVED_ARRIVAL_MAX_AGE_MS).toBe(60_000);
    const { maxAgeMs: _testPolicy, ...withoutPolicy } = base;
    const result = buildArrivalBoard(withoutPolicy);
    if (result.status !== 'checked') throw new Error('unexpected board');
    expect(result.arrivals).toHaveLength(1);
    expect(buildArrivalBoard({ ...withoutPolicy, maxAgeMs: null })).toEqual({ status: 'unavailable', reason: 'policy' });
  });
  it('exposes only individually mapped, fresh rows in a mixed response', () => {
    const result = buildArrivalBoard({ ...base, rows: [row,
      { ...row, arrvVhId: '124', calcDate: '2024-01-01T00:00:00+09:00' },
      { ...row, arrvVhId: '0', predictTravTm: '0' },
      { ...row, arrvVhId: '125', routeId: '405000002' },
      { ...row, arrvVhId: '126', predictTravTm: '-2' },
    ] });
    expect(result.status).toBe('checked');
    if (result.status !== 'checked') throw new Error('unexpected board');
    expect(result.arrivals).toHaveLength(1);
    expect(result.arrivals[0]?.predictedMinutes).toBe(20);
    expect(result.excluded).toEqual({ stale: 1, unverified: 2, invalid: 1, mismatch: 0, duplicate: 0 });
  });
  it('distinguishes no upstream rows from rows that cannot be trusted', () => {
    expect(buildArrivalBoard({ ...base, rows: [] })).toEqual({ status: 'empty', stationId });
    const result = buildArrivalBoard({ ...base, rows: [{ ...row, calcDate: '2024-01-01T00:00:00Z' }] });
    expect(result.status).toBe('checked');
    if (result.status === 'checked') { expect(result.arrivals).toEqual([]); expect(result.excluded.stale).toBe(1); }
  });
  it('does not turn a failed response into an empty board or timetable estimate', () => {
    expect(buildArrivalBoard({ ...base, httpStatus: 503 })).toEqual({ status: 'unavailable', reason: 'network' });
    expect(buildArrivalBoard({ ...base, httpStatus: 429 })).toEqual({ status: 'unavailable', reason: 'quota' });
    expect(buildArrivalBoard({ ...base, resultCode: '99' })).toEqual({ status: 'unavailable', reason: 'upstream' });
    expect(buildArrivalBoard({ ...base, rows: null })).toEqual({ status: 'unavailable', reason: 'format' });
  });
  it.each([null, -1, NaN, Infinity])('requires an explicit usable age policy (%s)', maxAgeMs => {
    expect(buildArrivalBoard({ ...base, maxAgeMs })).toEqual({ status: 'unavailable', reason: 'policy' });
  });
  it('expires a previously usable row without another provider call', () => {
    const boundary = Date.parse(row.calcDate) + 60_000;
    const at = buildArrivalBoard({ ...base, nowMs: boundary });
    const after = buildArrivalBoard({ ...base, nowMs: boundary + 1 });
    if (at.status !== 'checked' || after.status !== 'checked') throw new Error('unexpected board');
    expect(at.arrivals).toHaveLength(1); expect(after.arrivals).toHaveLength(0); expect(after.excluded.stale).toBe(1);
  });
  it('does not reuse rows for another selected station', () => {
    const result = buildArrivalBoard({ ...base, stationId: '406000002' });
    if (result.status !== 'checked') throw new Error('unexpected board');
    expect(result.arrivals).toEqual([]); expect(result.excluded.mismatch).toBe(1);
  });
  it('rejects conflicting duplicate vehicle events instead of choosing a prediction', () => {
    const result = buildArrivalBoard({ ...base, rows: [row, { ...row, predictTravTm: '9' }] });
    if (result.status !== 'checked') throw new Error('unexpected board');
    expect(result.arrivals).toEqual([]); expect(result.excluded.duplicate).toBe(2);
  });
  it('rejects conflicting predictions for numerically equivalent stop orders', () => {
    const result = buildArrivalBoard({ ...base, rows: [row,
      { ...row, stationOrd: '024', predictTravTm: '9' },
      { ...row, arrvVhId: '124', predictTravTm: '22' },
    ] });
    if (result.status !== 'checked') throw new Error('unexpected board');
    expect(result.arrivals.map(arrival => arrival.predictedMinutes)).toEqual([22]);
    expect(result.excluded.duplicate).toBe(2);
  });
  it('allows distinct vehicles and preserves provider input and prediction units', () => {
    const rows = [Object.freeze({ ...row }), Object.freeze({ ...row, arrvVhId: '124', predictTravTm: '22' })];
    const before = JSON.stringify(rows);
    const result = buildArrivalBoard({ ...base, rows: Object.freeze(rows) });
    if (result.status !== 'checked') throw new Error('unexpected board');
    expect(result.arrivals.map(r => r.predictedMinutes)).toEqual([20, 22]); expect(JSON.stringify(rows)).toBe(before);
  });
  it('does not present future or timezone-less rows as live', () => {
    for (const calcDate of ['2026-10-28T22:00:00+09:00', '2026-10-28T21:40:49']) {
      const result = buildArrivalBoard({ ...base, rows: [{ ...row, calcDate }] });
      if (result.status !== 'checked') throw new Error('unexpected board');
      expect(result.arrivals).toEqual([]); expect(result.excluded.unverified).toBe(1);
    }
  });
  it('rejects malformed non-string identity fields without serializing arbitrary objects', () => {
    const result = buildArrivalBoard({ ...base, rows: [{ ...row, routeId: 123n }] });
    if (result.status !== 'checked') throw new Error('unexpected board');
    expect(result.arrivals).toEqual([]); expect(result.excluded.invalid).toBe(1);
  });
});
