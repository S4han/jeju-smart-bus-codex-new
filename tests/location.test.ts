import { describe, expect, it, vi } from 'vitest';
import { LocalLocation, manualPoint, type LocalPoint, type LocationFailure } from '../src/domain/location';
import { requestDevicePosition } from '../src/browser/position';

// Synthetic coordinates; these tests are not station or device-location observations.
function fixture() {
  let success!: (point: LocalPoint) => void;
  let failure!: (reason: LocationFailure) => void;
  const request = vi.fn((s: typeof success, f: typeof failure) => { success = s; failure = f; });
  const location = new LocalLocation(request);
  return { location, request, succeed: (point: LocalPoint) => success(point), fail: (reason: LocationFailure) => failure(reason) };
}
describe('local origin lifecycle (AC-001/002, PRIV-001~003)', () => {
  it('does not request permission until explicitly requested and suppresses repeated pending requests', () => {
    const f = fixture();
    expect(f.request).not.toHaveBeenCalled();
    expect(f.location.getSnapshot()).toEqual({ status: 'idle' });
    f.location.request(); f.location.request();
    expect(f.request).toHaveBeenCalledTimes(1);
    expect(f.location.getSnapshot()).toEqual({ status: 'pending' });
  });
  it('copies only the selected coordinates rather than retaining the provider object', () => {
    const f = fixture(); const point = { latitude: 33, longitude: 126 };
    f.location.request(); f.succeed(point); point.latitude = 34;
    expect(f.location.getSnapshot()).toEqual({ status: 'selected', source: 'device', point: { latitude: 33, longitude: 126 } });
  });
  it.each(['denied', 'unavailable', 'timeout', 'unsupported', 'insecure'] as const)('allows manual selection after %s', reason => {
    const f = fixture(); f.location.request(); f.fail(reason);
    expect(f.location.getSnapshot()).toEqual({ status: 'error', reason });
    f.location.selectManual('33', '126');
    expect(f.location.getSnapshot().status).toBe('selected');
  });
  it('ignores late success and failure after the user clears or edits the location', () => {
    const f = fixture(); f.location.request(); f.location.clear(); f.succeed({ latitude: 33, longitude: 126 }); f.fail('denied');
    expect(f.location.getSnapshot()).toEqual({ status: 'idle' });
  });
  it('does not let a pending device request overwrite a manual choice', () => {
    const f = fixture(); f.location.request(); f.location.selectManual('34', '127'); f.succeed({ latitude: 33, longitude: 126 });
    expect(f.location.getSnapshot()).toEqual({ status: 'selected', source: 'manual', point: { latitude: 34, longitude: 127 } });
  });
  it('rejects duplicate or contradictory callbacks after a result settles', () => {
    const f = fixture(); f.location.request(); f.fail('denied'); f.succeed({ latitude: 33, longitude: 126 });
    expect(f.location.getSnapshot()).toEqual({ status: 'error', reason: 'denied' });
  });
  it('does not retain an old selection after invalid manual input', () => {
    const f = fixture(); f.location.selectManual('33', '126'); f.location.selectManual('', '126');
    expect(f.location.getSnapshot()).toEqual({ status: 'error', reason: 'invalid' });
  });
  it('rejects invalid device data and allows an explicit retry', () => {
    const f = fixture(); f.location.request(); f.succeed({ latitude: Infinity, longitude: 126 });
    expect(f.location.getSnapshot()).toEqual({ status: 'error', reason: 'invalid' });
    f.location.request(); expect(f.request).toHaveBeenCalledTimes(2);
  });
  it('does not expose provider exceptions as state or require a listener to work', () => {
    const location = new LocalLocation(() => { throw new Error('sensitive provider text'); });
    const listener = vi.fn(); const unsubscribe = location.subscribe(listener);
    location.request(); expect(location.getSnapshot()).toEqual({ status: 'error', reason: 'unavailable' });
    expect(listener).toHaveBeenCalledTimes(2); unsubscribe(); location.clear(); expect(listener).toHaveBeenCalledTimes(2);
  });
});
describe('explicit manual coordinate boundary', () => {
  it.each([['', '126'], [' ', '126'], ['33x', '126'], ['0x21', '126'], ['3.3e1', '126'], ['NaN', '126'], ['91', '126'], ['33', '181'], ['-91', '0'], ['0', '-181']])('rejects invalid pair %s %s', (lat, lng) => {
    expect(manualPoint(lat, lng)).toBeNull();
  });
  it.each([['90', '180'], ['-90', '-180'], ['0', '0'], [' 33.5 ', ' 126.5 ']])('accepts finite decimal pair %s %s', (lat, lng) => {
    expect(manualPoint(lat, lng)).toEqual({ latitude: Number(lat), longitude: Number(lng) });
  });
});
describe('browser position adapter', () => {
  it('requests once with no cached position, reduces the browser result and sanitizes errors', () => {
    const getCurrentPosition = vi.fn(); const success = vi.fn(); const failure = vi.fn();
    vi.stubGlobal('window', { isSecureContext: true }); vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    try {
      requestDevicePosition(success, failure);
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
      const [ok, fail, options] = getCurrentPosition.mock.calls[0]!;
      expect(options).toEqual({ maximumAge: 0, timeout: 10_000, enableHighAccuracy: false });
      ok({ coords: { latitude: 33, longitude: 126, altitude: 12 }, timestamp: 1 });
      expect(success).toHaveBeenCalledWith({ latitude: 33, longitude: 126 });
      fail({ code: 1, message: 'private details' }); expect(failure).toHaveBeenLastCalledWith('denied');
      fail({ code: 3 }); expect(failure).toHaveBeenLastCalledWith('timeout');
      fail({ code: 2 }); expect(failure).toHaveBeenLastCalledWith('unavailable');
    } finally { vi.unstubAllGlobals(); }
  });
  it.each([false, true])('fails safely without requesting location when unsupported/insecure (%s)', secure => {
    vi.stubGlobal('window', { isSecureContext: secure }); vi.stubGlobal('navigator', {});
    try {
      const success = vi.fn(), failure = vi.fn(); requestDevicePosition(success, failure);
      expect(success).not.toHaveBeenCalled(); expect(failure).toHaveBeenCalledWith(secure ? 'unsupported' : 'insecure');
    } finally { vi.unstubAllGlobals(); }
  });
});
