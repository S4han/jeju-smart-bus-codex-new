import { createMapSdkLoader } from './sdkLoader';

export interface MapOffset { x: number; y: number }
export interface MapInstance {
  getCenter(): object;
  getSize(): { width: number; height: number };
  getProjection(): { fromCoordToOffset(point: object): MapOffset; fromOffsetToCoord(point: MapOffset): object };
  panTo(point: object): void;
  destroy(): void; autoResize(): void;
  fitBounds(points: readonly object[], options: { maxZoom: number; top: number; right: number; bottom: number; left: number }): void;
}
export interface MarkerInstance { setMap(map: MapInstance | null): void; setIcon(icon: { content: HTMLElement }): void }
export interface NaverMaps {
  Point: new (x: number, y: number) => MapOffset;
  LatLng: new (latitude: number, longitude: number) => object;
  Map: new (element: HTMLElement, options: { center: object; zoom: number }) => MapInstance;
  Marker: new (options: { map: MapInstance; position: object; title: string; icon: { content: HTMLElement; anchor: MapOffset } }) => MarkerInstance;
  Event: { addListener(target: MarkerInstance, name: 'click', callback: () => void): object; addListener(target: MapInstance, name: 'tilesloaded', callback: () => void): object; removeListener(listener: object): void };
}
declare global {
  interface Window { naver?: { maps: NaverMaps }; navermap_authFailure?: () => void }
}
declare const __NAVER_MAP_CLIENT_ID__: string;
export const hasMapClientId = () => typeof __NAVER_MAP_CLIENT_ID__ === 'string' && __NAVER_MAP_CLIENT_ID__.length > 0;
let loader: ReturnType<typeof createMapSdkLoader<NaverMaps>> | null = null;
function browserLoader() {
  loader ??= createMapSdkLoader<NaverMaps>({
    getMaps: () => window.naver?.maps,
    installAuthFailure: failed => { window.navermap_authFailure = failed; },
    startTimer: (failed, milliseconds) => window.setTimeout(failed, milliseconds),
    cancelTimer: timer => window.clearTimeout(timer),
    onUnavailable: () => window.dispatchEvent(new Event('jeju-map-unavailable')),
    createScript(src, loaded, failed) {
      const script = document.createElement('script');
      script.async = true; script.referrerPolicy = 'origin';
      script.src = src; script.onload = loaded; script.onerror = failed;
      document.head.append(script);
      return () => { script.onload = null; script.onerror = null; };
    },
  });
  return loader;
}
export function markMapUnavailable(): void { browserLoader().markUnavailable(); }

/** Call only after consent. One shared attempt; no automatic retries. */
export function loadNaverMaps(): Promise<NaverMaps> {
  return browserLoader().load(hasMapClientId() ? __NAVER_MAP_CLIENT_ID__ : '');
}
