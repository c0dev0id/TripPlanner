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

  it('draw only from sources of their own, over any base map', () => {
    for (const overlay of OVERLAYS) {
      for (const sharpUntil of [undefined, 16, 19]) {
        const { sources, layers } = overlay.parts(sharpUntil);
        for (const layer of layers) expect(Object.keys(sources)).toContain('source' in layer ? layer.source : undefined);
      }
    }
  });

  it('ask each service for its roadworks as features, and leave Baden-Württemberg to its own', () => {
    const { sources, layers } = OVERLAYS[0]!.parts(undefined);
    expect(Object.values(sources).map((source) => (source as { data: string }).data.replace(/.*TYPENAMES=([^&]*).*/, '$1'))).toEqual(['mwvlw:umleitung', 'mwvlw:verlauf', 'mwvlw:baustelle', 'MobiData-BW:roadworks']);
    expect(layers.find((layer) => layer.id === 'roadworks-rlp-sites')).toMatchObject({ filter: ['!=', ['get', 'quelle'], 'Verkehrsministerium Baden-Württemberg'] });
  });

  it('draw a closure at least as wide as the road a blown-up base map shows', () => {
    const width = (sharpUntil: number | undefined, zoom: number) => {
      const line = OVERLAYS[1]!.parts(sharpUntil).layers.find((layer) => layer.id === 'closures-line')!;
      const stops = (line.paint as { 'line-width': unknown[] })['line-width'].slice(3) as number[];
      return Math.round(stops[stops.indexOf(zoom) + 1]! * 10) / 10;
    };
    expect([10, 14, 18, 20].map((zoom) => width(undefined, zoom))).toEqual([4, 6, 12, 12]);
    expect([16, 17, 19].map((zoom) => width(16, zoom))).toEqual([9, 19.2, 76.8]);
  });
});
