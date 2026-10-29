/** Browser adapter is supplied separately; tests never load a provider script. */
export interface SdkEnvironment<T> {
  getMaps(): T | undefined;
  createScript(src: string, loaded: () => void, failed: () => void): () => void;
  installAuthFailure(failed: () => void): void;
  startTimer(failed: () => void, milliseconds: number): number;
  cancelTimer(timer: number): void;
  onUnavailable(): void;
}

export function createMapSdkLoader<T>(environment: SdkEnvironment<T>) {
  let pending: Promise<T> | null = null;
  let unavailable = false;
  let timer: number | undefined;
  let detachScriptHandlers: (() => void) | undefined;
  let rejectPending: ((error: Error) => void) | undefined;
  const cleanup = () => {
    if (timer !== undefined) environment.cancelTimer(timer);
    timer = undefined;
    detachScriptHandlers?.(); detachScriptHandlers = undefined;
  };
  const markUnavailable = () => {
    if (unavailable) return;
    unavailable = true; cleanup();
    rejectPending?.(new Error('map_unavailable')); rejectPending = undefined;
    environment.onUnavailable();
  };
  return {
    markUnavailable,
    load(publicId: string): Promise<T> {
      if (!publicId) return Promise.reject(new Error('configuration'));
      if (unavailable) return Promise.reject(new Error('map_unavailable'));
      if (pending) return pending;
      pending = new Promise<T>((resolve, reject) => {
        rejectPending = reject;
        environment.installAuthFailure(markUnavailable);
        timer = environment.startTimer(markUnavailable, 15_000);
        detachScriptHandlers = environment.createScript(
          `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(publicId)}`,
          () => {
            if (unavailable) return;
            const maps = environment.getMaps();
            if (!maps) { markUnavailable(); return; }
            cleanup(); rejectPending = undefined; resolve(maps);
          }, markUnavailable,
        );
      });
      return pending;
    },
  };
}
