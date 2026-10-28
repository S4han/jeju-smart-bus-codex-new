export interface LocalPoint {
  readonly latitude: number;
  readonly longitude: number;
}
export type LocationFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure' | 'invalid';
export type LocationState =
  | { readonly status: 'idle' }
  | { readonly status: 'pending' }
  | { readonly status: 'selected'; readonly source: 'device' | 'manual'; readonly point: LocalPoint }
  | { readonly status: 'error'; readonly reason: LocationFailure };
export type RequestPosition = (
  success: (point: LocalPoint) => void,
  failure: (reason: LocationFailure) => void,
) => void;

function validPoint(point: LocalPoint): boolean {
  return Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}
/** Decimal degrees only. Empty strings, exponents and partial numbers are not selections. */
export function manualPoint(latitude: string, longitude: string): LocalPoint | null {
  const decimal = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
  if (!decimal.test(latitude.trim()) || !decimal.test(longitude.trim())) return null;
  const point = { latitude: Number(latitude), longitude: Number(longitude) };
  return validPoint(point) ? point : null;
}

/** Per-page memory only. No URLs, persistence, logging or external service calls. */
export class LocalLocation {
  private state: LocationState = { status: 'idle' };
  private revision = 0;
  private listeners = new Set<() => void>();
  constructor(private readonly requestPosition: RequestPosition) {}
  getSnapshot = (): LocationState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(state: LocationState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  clear = (): void => {
    this.revision++;
    this.publish({ status: 'idle' });
  };
  selectManual = (latitude: string, longitude: string): void => {
    this.revision++;
    const point = manualPoint(latitude, longitude);
    this.publish(point ? { status: 'selected', source: 'manual', point: Object.freeze(point) } :
      { status: 'error', reason: 'invalid' });
  };
  request = (): void => {
    if (this.state.status === 'pending') return;
    const revision = ++this.revision;
    this.publish({ status: 'pending' });
    const fail = (reason: LocationFailure) => {
      if (revision !== this.revision) return;
      this.revision++;
      this.publish({ status: 'error', reason });
    };
    try {
      this.requestPosition(point => {
        if (revision !== this.revision) return;
        if (!validPoint(point)) { fail('invalid'); return; }
        this.revision++;
        this.publish({ status: 'selected', source: 'device',
          point: Object.freeze({ latitude: point.latitude, longitude: point.longitude }) });
      }, fail);
    } catch {
      fail('unavailable');
    }
  };
}
