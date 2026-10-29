import { describe, expect, it } from 'vitest';
import { createMapSdkLoader, type SdkEnvironment } from '../src/map/sdkLoader';
function fixture() {
  let maps: object | undefined;
  let authFailure = () => {};
  const scripts: { src: string; loaded(): void; failed(): void; detached: boolean }[] = [];
  const timers = new Map<number, () => void>();
  let notifications = 0;
  const environment: SdkEnvironment<object> = {
    getMaps: () => maps,
    createScript(src, loaded, failed) {
      const script = { src, loaded, failed, detached: false }; scripts.push(script);
      return () => { script.detached = true; };
    },
    installAuthFailure: failed => { authFailure = failed; },
    startTimer: (failed, duration) => { expect(duration).toBe(15_000); timers.set(1, failed); return 1; },
    cancelTimer: id => { timers.delete(id); },
    onUnavailable: () => { notifications++; },
  };
  return { loader: createMapSdkLoader(environment), scripts, timers,
    setMaps: () => { maps = {}; return maps; }, authFailure: () => authFailure(), notifications: () => notifications };
}
describe('consent-triggered shared SDK loader, synthetic adapter only', () => {
  it('does not insert scripts or start timers until explicitly loaded with an identifier', async () => {
    const f = fixture(); await expect(f.loader.load('')).rejects.toThrow('configuration');
    expect(f.scripts).toHaveLength(0); expect(f.timers.size).toBe(0);
  });
  it('shares concurrent requests and resolved namespace without another script', async () => {
    const f = fixture(); const a = f.loader.load('synthetic-id'), b = f.loader.load('synthetic-id');
    expect(a).toBe(b); expect(f.scripts).toHaveLength(1);
    const maps = f.setMaps(); f.scripts[0]!.loaded();
    expect(await a).toBe(maps); expect(await f.loader.load('synthetic-id')).toBe(maps);
    expect(f.timers.size).toBe(0); expect(f.scripts[0]!.detached).toBe(true);
  });
  for (const failure of ['network', 'auth', 'timeout', 'namespace'] as const) {
    it(`settles ${failure} failure and prevents retry or recovery by a late load`, async () => {
      const f = fixture(), attempt = f.loader.load('synthetic-id');
      const rejected = expect(attempt).rejects.toThrow('map_unavailable');
      if (failure === 'network') f.scripts[0]!.failed();
      if (failure === 'auth') f.authFailure();
      if (failure === 'timeout') f.timers.get(1)!();
      if (failure === 'namespace') f.scripts[0]!.loaded();
      await rejected;
      f.setMaps(); f.scripts[0]!.loaded(); f.authFailure();
      await expect(f.loader.load('synthetic-id')).rejects.toThrow('map_unavailable');
      expect(f.scripts).toHaveLength(1); expect(f.timers.size).toBe(0); expect(f.notifications()).toBe(1);
    });
  }
  it('invalidates an already resolved SDK after late authentication or tile failure', async () => {
    for (const failure of ['auth', 'tiles']) {
      const f = fixture(); const attempt = f.loader.load('synthetic-id');
      f.setMaps(); f.scripts[0]!.loaded(); await attempt;
      if (failure === 'auth') f.authFailure(); else f.loader.markUnavailable();
      await expect(f.loader.load('synthetic-id')).rejects.toThrow('map_unavailable');
      expect(f.scripts).toHaveLength(1); expect(f.notifications()).toBe(1);
    }
  });
});
