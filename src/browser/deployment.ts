export const mapReviewOrigin = 'https://jeju-smart-bus-codex-new.vercel.app';
export function mapOriginAllowed(origin: string): boolean {
  if (origin === mapReviewOrigin) return true;
  try { const url = new URL(origin); return url.protocol === 'http:' && url.hostname === 'localhost'; }
  catch { return false; }
}
/** Hosted review never inherits a local BIS approval ledger. */
export function hostedReview(): boolean {
  return (typeof location !== 'undefined' && location.origin === mapReviewOrigin) ||
    (typeof document !== 'undefined' && document.documentElement.dataset.deploymentReview === 'true');
}
