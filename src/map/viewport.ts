import type { MapOffset } from './naver';
/** Pixel geometry only. No coordinates, logging, storage, or provider calls. */
export function offsetToReveal(target: MapOffset, center: MapOffset,
  size: { width: number; height: number },
  padding: { top: number; right: number; bottom: number; left: number }): MapOffset | null {
  if (![target.x, target.y, center.x, center.y, size.width, size.height,
    padding.top, padding.right, padding.bottom, padding.left].every(Number.isFinite) ||
    Math.min(padding.top, padding.right, padding.bottom, padding.left) < 0 ||
    size.width <= padding.left + padding.right || size.height <= padding.top + padding.bottom) return null;
  const x = target.x - center.x, y = target.y - center.y;
  if (x >= -size.width / 2 + padding.left && x <= size.width / 2 - padding.right &&
    y >= -size.height / 2 + padding.top && y <= size.height / 2 - padding.bottom) return null;
  return { x: target.x - (padding.left - padding.right) / 2, y: target.y - (padding.top - padding.bottom) / 2 };
}
