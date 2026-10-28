import { describe, expect, it } from 'vitest';
import { classifyObservation, matchStop, parseStation, parseStopEvent } from '../src/domain/bis';
// Synthetic unit cases; these do not constitute API gate evidence.
const station = { stationId: '405000001', stationNm: '테스트 정류장', localX: '126.5', localY: '33.5', useYn: 'Y' };
const event = { routeId: '405000001', stationId: '406000001', stationOrd: '2', updnDir: '0', useYn: 'Y' };
describe('public data boundaries (NFR-004)', () => {
  it('retains IDs as strings and does not infer CRS', () => {
    const result = parseStation(station);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.coordinates?.crs).toBe('unverified');
  });
  it.each([['33.5','126.5'],['null','33.5'],['','33.5'],['Infinity','33.5']])('does not invent or swap invalid coordinates %s %s', (x,y) => {
    const result = parseStation({ ...station, localX: x, localY: y });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.coordinates).toBeNull();
  });
  it('rejects missing identity rather than manufacturing it', () => {
    expect(parseStation({ ...station, stationId: '' })).toEqual({ status:'error', kind:'format' });
  });
  it.each(['0x7e', '0b1111110', '0o176', '1.265e2'])('does not reinterpret non-decimal coordinate text %s', localX => {
    const result = parseStation({ ...station, localX });
    if (result.status !== 'ok') throw new Error('unexpected identity failure');
    expect(result.data.coordinates).toBeNull();
  });
  it('preserves unknown station activation status', () => {
    const result = parseStation({ ...station, useYn:'A' });
    if (result.status !== 'ok') throw new Error('unexpected parse failure');
    expect(result.data.status).toBe('unknown');
  });
  it('separates obsolete rows from usable events', () => {
    expect(parseStopEvent({ ...event, useYn:'N' })).toEqual({ status:'empty' });
    expect(parseStopEvent({ ...event, useYn:'A' })).toEqual({ status:'unverified', reason:'policy' });
  });
  it.each(['0','-1','1.5','null'])('rejects invalid stop order %s', order => {
    expect(parseStopEvent({ ...event, stationOrd:order })).toEqual({ status:'error', kind:'format' });
  });
  it('retains repeat visits as separate stop events', () => {
    const a = parseStopEvent(event), b = parseStopEvent({ ...event, stationOrd:'8' });
    expect(a.status).toBe('ok'); expect(b.status).toBe('ok'); expect(a).not.toEqual(b);
  });
  it.each(['0x2', '0b10', '2e0'])('does not reinterpret non-decimal stop order %s', stationOrd => {
    expect(parseStopEvent({ ...event, stationOrd })).toEqual({ status: 'error', kind: 'format' });
  });
  it('does not accept a stop event for a different station', () => {
    const e = parseStopEvent(event);
    if (e.status !== 'ok') throw new Error('unexpected event failure');
    expect(matchStop(e.data,'406000002')).toEqual({ status:'mismatch' });
  });
});
describe('observation age without an invented production policy', () => {
  const now = Date.parse('2026-10-28T20:38:00+09:00');
  it('requires an explicit freshness policy', () => expect(classifyObservation('2026-10-28T20:37:49+09:00',now,null)).toEqual({ status:'unverified',reason:'policy' }));
  it('uses the explicit time offset', () => expect(classifyObservation('2026-10-28T11:37:49Z',now,11000)).toEqual({ status:'ok',data:11000 }));
  it('rejects years-old rows as stale under an explicit test policy', () => expect(classifyObservation('2024-08-07T17:39:24+09:00',now,60000).status).toBe('stale'));
  it.each([null,'2026-10-28 20:37:49','not-a-date','2026-10-29T00:00:00+09:00'])('does not make a real-time claim for %s', timestamp => expect(classifyObservation(timestamp,now,60000)).toEqual({ status:'unverified',reason:'timestamp' }));
  it.each(['2026-02-30T12:00:00+09:00','2026-10-27T24:00:00+09:00'])('rejects normalized invalid calendar values %s', timestamp => expect(classifyObservation(timestamp,now,60000)).toEqual({ status:'unverified',reason:'timestamp' }));
});
