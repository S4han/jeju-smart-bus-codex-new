import { describe, expect, it } from 'vitest';
import { classifyResponse, validateArrival } from '../src/domain/arrivals';
// Synthetic boundary cases. The 60-second test policy is not a production default.
const now = Date.parse('2026-10-28T20:38:00+09:00');
const station = '406000001';
const mapping = [{ routeId:'405000001', stationId:station, direction:'0', order:2 }];
const row = { routeId:'405000001', stationOrd:'2', updnDir:'0', arrvVhId:'123', predictTravTm:'8', leftStation:'9', calcDate:'2026-10-28T20:37:49+09:00' };
describe('arrival identity and freshness', () => {
  it('accepts a mapped, fresh row without changing documented minutes', () => {
    const r = validateArrival(row, station, mapping, now,60000);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.data.predictedMinutes).toBe(8);
  });
  it('does not infer mapping from a route ID alone', () => expect(validateArrival(row,station,[],now,60000)).toEqual({status:'unverified',reason:'mapping'}));
  it('rejects matching route/order with wrong station', () => expect(validateArrival(row,'406000002',mapping,now,60000)).toEqual({status:'mismatch'}));
  it('rejects ambiguous mapping even if one candidate matches', () => expect(validateArrival(row,station,[...mapping,...mapping],now,60000)).toEqual({status:'mismatch'}));
  it('keeps opposite direction separate', () => expect(validateArrival({...row,updnDir:'1'},station,mapping,now,60000)).toEqual({status:'unverified',reason:'mapping'}));
  it('does not adopt a freshness threshold implicitly', () => expect(validateArrival(row,station,mapping,now,null)).toEqual({status:'unverified',reason:'policy'}));
  it('does not label an old nonzero-vehicle row real-time', () => expect(validateArrival({...row,calcDate:'2024-08-07T17:39:24+09:00'},station,mapping,now,60000).status).toBe('stale'));
  it('keeps zero vehicle and zero minutes unverified rather than arriving now', () => expect(validateArrival({...row,arrvVhId:'0',predictTravTm:'0'},station,mapping,now,60000).status).toBe('unverified'));
  it.each(['-1','1.5','','null','Infinity','9007199254740992'])('rejects unsafe prediction %s', value => expect(validateArrival({...row,predictTravTm:value},station,mapping,now,60000)).toEqual({status:'error',kind:'format'}));
});
describe('decoded upstream response', () => {
  it('separates empty success from missing body', () => {
    expect(classifyResponse(200,'00',[])).toEqual({status:'empty'});
    expect(classifyResponse(200,'00',null)).toEqual({status:'error',kind:'format'});
  });
  it('does not treat HTTP success as provider success', () => expect(classifyResponse(200,'unexpected',[row])).toEqual({status:'error',kind:'upstream'}));
  it('classifies explicit HTTP quota exhaustion', () => expect(classifyResponse(429,null,null)).toEqual({status:'quota'}));
  it('does not invent quota meaning for unmeasured provider codes', () => expect(classifyResponse(200,'22',null)).toEqual({status:'error',kind:'upstream'}));
  it('rejects an HTTP error even if decoded data exists', () => expect(classifyResponse(503,'00',[row])).toEqual({status:'error',kind:'network'}));
});
