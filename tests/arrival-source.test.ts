import { afterEach, expect, it, vi } from 'vitest';
import { requestArrivals } from '../src/browser/arrivals';
afterEach(()=>vi.unstubAllGlobals());
const snapshot={stationId:'406000191',httpStatus:200,resultCode:'00',rows:[],mapping:[]};
it('sends only the selected public ID in a same-origin no-store POST',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>snapshot});vi.stubGlobal('fetch',fetch);
 const signal=new AbortController().signal;
 expect(await requestArrivals('406000191',signal)).toEqual(snapshot);
 expect(fetch).toHaveBeenCalledWith('/api/arrivals',expect.objectContaining({method:'POST',body:'{"stationId":"406000191"}',signal,cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'}));
});
it.each([429,502])('preserves HTTP failure %s without decoding untrusted provider errors',async status=>{
 const decode=vi.fn();vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status,json:decode}));
 const result=await requestArrivals('406000191',new AbortController().signal);
 expect(result.httpStatus).toBe(status);expect(result.rows).toBeNull();expect(decode).not.toHaveBeenCalled();
});
it.each([{...snapshot,stationId:'406000192'},{...snapshot,rows:[null]},{...snapshot,mapping:[{routeId:'bad'}]}])('rejects mismatched or malformed snapshots',async data=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>data}));
 await expect(requestArrivals('406000191',new AbortController().signal)).rejects.toThrow('format');
});
