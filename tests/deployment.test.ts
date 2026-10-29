import { afterEach, expect, it, vi } from 'vitest';
import { hostedReview, mapOriginAllowed, mapReviewOrigin } from '../src/browser/deployment';
import { requestArrivals } from '../src/browser/arrivals';
afterEach(() => vi.unstubAllGlobals());
it('allows only the approved review domain and local HTTP map origin', () => {
  expect(mapOriginAllowed(mapReviewOrigin)).toBe(true);
  expect(mapOriginAllowed('http://localhost:4173')).toBe(true);
  for (const origin of ['https://jeju-smart-bus-codex-new.vercel.app.evil.invalid', 'https://other.vercel.app', 'http://jeju-smart-bus-codex-new.vercel.app', 'https://jeju-smart-bus-codex-new.vercel.app:444', 'invalid']) {
    expect(mapOriginAllowed(origin)).toBe(false);
  }
});
it('blocks BIS before fetch at the deployment origin even if the DOM flag is absent', async () => {
  vi.stubGlobal('location', { origin: mapReviewOrigin });
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  expect(hostedReview()).toBe(true);
  expect((await requestArrivals('406000191', new AbortController().signal)).httpStatus).toBe(429);
  expect(fetch).not.toHaveBeenCalled();
});
it('blocks BIS on deployment previews with an arbitrary origin through the build flag', async () => {
  vi.stubGlobal('location', { origin: 'https://preview.example' });
  vi.stubGlobal('document', { documentElement: { dataset: { deploymentReview: 'true' } } });
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  expect((await requestArrivals('406000191', new AbortController().signal)).httpStatus).toBe(429);
  expect(fetch).not.toHaveBeenCalled();
});
