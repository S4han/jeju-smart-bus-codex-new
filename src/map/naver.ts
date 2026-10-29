export interface MapInstance {
  destroy(): void; autoResize(): void;
  fitBounds(points: readonly object[], options: { maxZoom: number; top: number; right: number; bottom: number; left: number }): void;
}
export interface MarkerInstance { setMap(map: MapInstance | null): void; setIcon(icon: { content: HTMLElement }): void }
export interface NaverMaps {
  LatLng: new (latitude: number, longitude: number) => object;
  Map: new (element: HTMLElement, options: { center: object; zoom: number }) => MapInstance;
  Marker: new (options: { map: MapInstance; position: object; title: string; icon: { content: HTMLElement } }) => MarkerInstance;
  Event: { addListener(target: MarkerInstance, name: 'click', callback: () => void): object; addListener(target: MapInstance, name: 'tilesloaded', callback: () => void): object; removeListener(listener: object): void };
}
declare global {
  interface Window { naver?: { maps: NaverMaps }; navermap_authFailure?: () => void }
}
declare const __NAVER_MAP_CLIENT_ID__: string;
export const hasMapClientId = () => typeof __NAVER_MAP_CLIENT_ID__ === 'string' && __NAVER_MAP_CLIENT_ID__.length > 0;
let sdk: Promise<NaverMaps> | null = null;
let unavailable = false;

export function markMapUnavailable(): void {
  unavailable = true;
  window.dispatchEvent(new Event('jeju-map-unavailable'));
}

/** Call only after consent. No automatic retry and no user coordinates in the SDK URL. */
export function loadNaverMaps(): Promise<NaverMaps> {
  if (!hasMapClientId()) return Promise.reject(new Error('configuration'));
  if (unavailable) return Promise.reject(new Error('map_unavailable'));
  if (sdk) return sdk;
  sdk = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      window.clearTimeout(timer); script.onload = null; script.onerror = null;
      markMapUnavailable();
      reject(new Error('map_unavailable'));
    };
    const timer = window.setTimeout(fail, 15_000);
    window.navermap_authFailure = fail;
    script.async = true;
    script.referrerPolicy = 'origin';
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(__NAVER_MAP_CLIENT_ID__)}`;
    script.onerror = fail;
    script.onload = () => {
      if (!window.naver?.maps) { fail(); return; }
      window.clearTimeout(timer); script.onload = null; script.onerror = null;
      resolve(window.naver.maps);
    };
    document.head.append(script);
  });
  return sdk;
}
