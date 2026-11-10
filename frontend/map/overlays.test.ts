import { beforeEach, describe, expect, it } from 'vitest';
import { OVERLAYS, isShown, shownOverlays, toggleOverlay } from './overlays';

describe('the overlays', () => {
  beforeEach(() => localStorage.clear());

  it('are off until switched on, and keep that', () => {
    const [roadworks, closures] = OVERLAYS;
    expect(shownOverlays()).toEqual([]);
    toggleOverlay(closures!);
    toggleOverlay(roadworks!);
    expect(shownOverlays()).toEqual([roadworks, closures]);
    expect(localStorage.getItem('planner.overlays')).toBe('closures,roadworks');
    toggleOverlay(closures!);
    expect(isShown(closures!)).toBe(false);
    toggleOverlay(roadworks!);
    expect(localStorage.getItem('planner.overlays')).toBeNull();
  });

  it('draw only from sources of their own', () => {
    for (const overlay of OVERLAYS) {
      for (const layer of overlay.layers) expect(Object.keys(overlay.sources)).toContain('source' in layer ? layer.source : undefined);
    }
  });
});
