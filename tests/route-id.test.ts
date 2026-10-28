import { describe, expect, it } from 'vitest';
import { compareRouteIds, createRouteId } from '../src/domain/route-id';
const leg = { routeId:'405000001', direction:'0', boardOrder:1, alightOrder:10 };
describe('U-003 stable identity', () => {
  it('is reproducible after a JSON round trip', () => {
    expect(createRouteId([leg])).toBe(createRouteId(JSON.parse(JSON.stringify([leg]))));
  });
  it('has an explicit version and exact unambiguous encoding', () => {
    expect(createRouteId([leg])).toBe('route:v1|405000001:0:0000000000000001:0000000000000010');
  });
  it.each([
    { ...leg,routeId:'405000002' }, { ...leg,direction:'1' },
    { ...leg,boardOrder:2 }, { ...leg,alightOrder:11 },
  ])('distinguishes every identity field %j', other => expect(createRouteId([other])).not.toBe(createRouteId([leg])));
  it('preserves bus-leg order', () => {
    const second = { ...leg,routeId:'405000002' };
    expect(createRouteId([leg,second])).not.toBe(createRouteId([second,leg]));
  });
  it('allows up to two transfers without inferring their feasibility', () => expect(createRouteId([leg,leg,leg]).split('|')).toHaveLength(4));
  it.each([{ legs:[] },{ legs:[leg,leg,leg,leg] }])('rejects an unsupported bus-leg count', ({legs}) => expect(() => createRouteId(legs)).toThrow());
  it.each([0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])('rejects unsafe order %s', order => expect(() => createRouteId([{...leg,boardOrder:order}])).toThrow());
  it.each([1,0])('rejects an alighting order at or before boarding %s', order => expect(() => createRouteId([{...leg,alightOrder:order}])).toThrow());
  it.each(['0:1','01','-1',''])('rejects ambiguous direction tokens %s', direction => expect(() => createRouteId([{...leg,direction}])).toThrow());
  it('does not mutate input while creating identity', () => {
    const frozen = Object.freeze([Object.freeze({...leg})]);
    expect(() => createRouteId(frozen)).not.toThrow();
  });
  it('keeps numeric stop-order identity stable in lexical ties', () => {
    const a = createRouteId([{...leg,boardOrder:2,alightOrder:20}]);
    const b = createRouteId([{...leg,boardOrder:10,alightOrder:20}]);
    expect(compareRouteIds(a,b)).toBe(-1);
    expect(compareRouteIds(b,a)).toBe(1);
    expect(compareRouteIds(a,a)).toBe(0);
  });
  it('produces the same tie order for differently ordered inputs', () => {
    const ids = [leg,{...leg,direction:'1'},{...leg,routeId:'405000002'}].map(x => createRouteId([x]));
    expect([...ids].sort(compareRouteIds)).toEqual([...ids].reverse().sort(compareRouteIds));
  });
});
