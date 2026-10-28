import type { RequestPosition } from '../domain/location';

/** Called only after the user presses the location button; never on import/mount. */
export const requestDevicePosition: RequestPosition = (success, failure) => {
  if (!window.isSecureContext) { failure('insecure'); return; }
  if (!navigator.geolocation) { failure('unsupported'); return; }
  navigator.geolocation.getCurrentPosition(
    position => success({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
    error => failure(error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable'),
    { maximumAge: 0, timeout: 10_000, enableHighAccuracy: false },
  );
};
