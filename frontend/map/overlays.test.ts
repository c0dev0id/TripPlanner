import { beforeEach, describe, expect, it } from 'vitest';
import { CLOSURES } from './closuresOverlay';
import { OVERLAYS, isShown, shownOverlays, toggleOverlay } from './overlays';
import { ROADWORKS } from './roadworksOverlay';

describe('the overlays', () => {
  beforeEach(() => localStorage.clear());

  it('are off until switched on, and keep that', () => {
    expect(shownOverlays()).toEqual([]);
    toggleOverlay(CLOSURES);
    toggleOverlay(ROADWORKS);
    expect(shownOverlays()).toEqual([ROADWORKS, CLOSURES]);
    expect(localStorage.getItem('planner.overlays')).toBe('closures,roadworks');
    toggleOverlay(CLOSURES);
    expect(isShown(CLOSURES)).toBe(false);
    toggleOverlay(ROADWORKS);
    expect(localStorage.getItem('planner.overlays')).toBeNull();
  });

  it('draw only from sources of their own, answer taps only on layers of their own and have every picture they ask for', () => {
    for (const overlay of OVERLAYS) {
      for (const sharpUntil of [Infinity, 16, 19]) {
        const { sources, layers } = overlay.parts(sharpUntil);
        for (const layer of layers) expect(Object.keys(sources)).toContain('source' in layer ? layer.source : undefined);
        for (const tap of overlay.taps) for (const id of tap.layers) expect(layers.map((layer) => layer.id)).toContain(id);
      }
      expect([...overlay.images.values()]).toContain(overlay.sign);
    }
  });
});
