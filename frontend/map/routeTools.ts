import type { Map as MapLibreMap } from 'maplibre-gl';
import { nearestLine, type XY } from '../geo/nearest';
import type { LngLat, Route } from '../model/trip';
import { legCoordinates, routeLegs } from '../routing/legs';
import { decodeCached } from '../routing/polyline';
import { toLngLat } from './markers';

/** Points as the map shows them on screen, in CSS pixels. */
function onScreen(map: MapLibreMap, points: readonly LngLat[]): XY[] {
  return points.map((p) => {
    const { x, y } = map.project(p);
    return [x, y];
  });
}

/** Where a tap hit a route: the leg (from its point `legIndex` to the next) and the spot on the line. */
export interface LineHit {
  legIndex: number;
  lngLat: LngLat;
}

/**
 * The leg of the route a tap hits, within `tolerance` CSS pixels of its line, with the
 * closest place on the line, so that a point or stop inserted there keeps the route's
 * shape until it is moved.
 */
export function hitRouteLine(map: MapLibreMap, route: Route, tap: XY, tolerance: number): LineHit | undefined {
  const lines = routeLegs(route).map((leg) => onScreen(map, legCoordinates(route, leg, decodeCached)));
  const hit = nearestLine(lines, tap);
  if (!hit || hit.distance > tolerance) return undefined;
  return { legIndex: hit.index, lngLat: toLngLat(map.unproject([hit.point[0], hit.point[1]])) };
}
