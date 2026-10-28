/** NFR-004: unknown and unavailable data never become fabricated results. */
export type DataResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'empty' }
  | { status: 'stale'; observedAt: string }
  | { status: 'estimated'; data: T; source: string }
  | { status: 'unverified'; reason: 'timestamp' | 'policy' | 'mapping' }
  | { status: 'error'; kind: 'network' | 'format' | 'upstream' }
  | { status: 'quota' }
  | { status: 'mismatch' };
