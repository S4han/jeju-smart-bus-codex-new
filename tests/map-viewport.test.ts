import { describe, expect, it } from 'vitest';
import { offsetToReveal } from '../src/map/viewport';
const center = { x: 200, y: 300 }, size = { width: 400, height: 300 };
const padding = { top: 30, right: 30, bottom: 30, left: 30 };
describe('selected map marker visibility, synthetic pixels only', () => {
  it('keeps the viewport when a marker is visible, including padded boundaries', () => {
    for (const target of [center, { x: 30, y: 180 }, { x: 370, y: 420 }]) {
      expect(offsetToReveal(target, center, size, padding)).toBeNull();
    }
  });
  it('reveals an offscreen marker at the usable center without requesting zoom changes', () => {
    const target = { x: 600, y: 100 };
    expect(offsetToReveal(target, center, size, padding)).toEqual(target);
    expect(offsetToReveal(target, center, size, { ...padding, left: 110, top: 70 })).toEqual({ x: 560, y: 80 });
  });
  it('ignores collapsed layouts or invalid projection output instead of panning to invalid values', () => {
    expect(offsetToReveal({ x: NaN, y: 0 }, center, size, padding)).toBeNull();
    expect(offsetToReveal(center, center, { width: 0, height: 300 }, padding)).toBeNull();
    expect(offsetToReveal(center, center, { width: 60, height: 300 }, padding)).toBeNull();
    expect(offsetToReveal(center, center, size, { ...padding, left: -1 })).toBeNull();
  });
});
