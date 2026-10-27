import type { Map as MapLibreMap } from 'maplibre-gl';
import { nearestLine, type XY } from '../geo/nearest';
import type { Day, LngLat } from '../model/trip';
import { legCoordinates, routeLegs } from '../routing/legs';
import { toLngLat } from './markers';
import { decodeCached } from './routeOverlay';

/** Points as the map shows them on screen, in CSS pixels. */
function onScreen(map: MapLibreMap, points: readonly LngLat[]): XY[] {
  return points.map((p) => {
    const { x, y } = map.project(p);
    return [x, y];
  });
}

/** Where a tap hit a day's routes: the route, the leg of it (from its point `legIndex` to the next), and the spot on the line. */
export interface LineHit {
  routeIndex: number;
  legIndex: number;
  lngLat: LngLat;
}

/**
 * The leg of the day's routes a tap hits, within `tolerance` CSS pixels of its line, with
 * the closest place on the line, so that a point or stop inserted there keeps the route's
 * shape until it is moved.
 */
export function hitRouteLine(map: MapLibreMap, day: Day, tap: XY, tolerance: number): LineHit | undefined {
  const legs: { routeIndex: number; legIndex: number }[] = [];
  const lines: XY[][] = [];
  day.routes.forEach((route, routeIndex) => {
    routeLegs(route).forEach((leg, legIndex) => {
      legs.push({ routeIndex, legIndex });
      lines.push(onScreen(map, legCoordinates(route, leg, decodeCached)));
    });
  });
  const hit = nearestLine(lines, tap);
  if (!hit || hit.distance > tolerance) return undefined;
  return { ...legs[hit.index]!, lngLat: toLngLat(map.unproject([hit.point[0], hit.point[1]])) };
}
