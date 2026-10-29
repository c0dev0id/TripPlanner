import { distanceBetween } from '../geo/measure';
import type { LngLat, Route, RoutedLeg } from '../model/trip';
import { decodePolyline } from './polyline';

/** What a leg is routed with: the profile and the motorway dial. */
export type Costing = Pick<Route, 'profile' | 'highways'>;

/** The key a routed leg's geometry is kept under: the costing and both end points (exact coordinates). */
export function legKey(costing: Costing, from: LngLat, to: LngLat): string {
  return `${costing.profile}:${costing.highways}/${from[0]},${from[1]};${to[0]},${to[1]}`;
}

/** A leg drawn and exported as the straight line between its ends, never routed. */
export interface StraightLeg {
  from: LngLat;
  to: LngLat;
  straight: true;
}

/** A leg routed along the roads, its geometry kept under its key. */
export interface RoadLeg {
  from: LngLat;
  to: LngLat;
  straight: false;
  key: string;
}

export type Leg = StraightLeg | RoadLeg;

export type RoutePath = Costing & Pick<Route, 'points'>;

/** The legs of a route: one per pair of consecutive points, straight where the second point says so. */
export function routeLegs(route: RoutePath): Leg[] {
  const legs: Leg[] = [];
  for (let i = 1; i < route.points.length; i++) {
    const from = route.points[i - 1]!.lngLat;
    const to = route.points[i]!.lngLat;
    legs.push(route.points[i]!.straight === true ? { from, to, straight: true } : { from, to, straight: false, key: legKey(route, from, to) });
  }
  return legs;
}

/** The legs that are routed, not straight. */
export function routedLegs(route: RoutePath): RoadLeg[] {
  return routeLegs(route).filter((leg): leg is RoadLeg => !leg.straight);
}

/** Routed and straight legs are drawn as part of the route; pending and failed ones wait for routing. */
export type LegState = 'routed' | 'straight' | 'pending' | 'failed';

export function legState(route: Pick<Route, 'legs'>, leg: Leg, failed: ReadonlySet<string>): LegState {
  if (leg.straight) return 'straight';
  if (leg.key in route.legs) return 'routed';
  return failed.has(leg.key) ? 'failed' : 'pending';
}

/** The line of a leg: its routed geometry once it has arrived, the straight line between its ends otherwise. */
export function legCoordinates(route: Pick<Route, 'legs'>, leg: Leg, decode = decodePolyline): LngLat[] {
  const routed = leg.straight ? undefined : route.legs[leg.key];
  return routed ? decode(routed.geometry) : [leg.from, leg.to];
}

/** The length of a leg in metres: as routed, or as the crow flies for a straight leg or one not routed yet. */
export function legDistance(route: Pick<Route, 'legs'>, leg: Leg): number {
  const routed = leg.straight ? undefined : route.legs[leg.key];
  return routed ? routed.distanceM : distanceBetween(leg.from, leg.to);
}

/** The length of a route in metres, legs not routed yet counted as the crow flies. */
export function routeDistance(route: RoutePath & Pick<Route, 'legs'>): number {
  return routeLegs(route).reduce((sum, leg) => sum + legDistance(route, leg), 0);
}

/** The pace assumed for a leg the routing has not timed: a straight one, one not routed yet, or one imported with its way. */
const ASSUMED_SPEED_MPS = 50 / 3.6;

/** The riding time of a leg in seconds: as routed, or at the assumed pace over its way or, without one, as the crow flies. */
export function legDuration(route: Pick<Route, 'legs'>, leg: Leg): number {
  const routed = leg.straight ? undefined : route.legs[leg.key];
  if (!routed) return distanceBetween(leg.from, leg.to) / ASSUMED_SPEED_MPS;
  return routed.durationS ?? routed.distanceM / ASSUMED_SPEED_MPS;
}

/** The routed legs the route still needs; everything else, straight legs included, is dropped. */
export function pruneLegs(route: RoutePath & Pick<Route, 'legs'>): Record<string, RoutedLeg> {
  const needed = new Set(routedLegs(route).map((l) => l.key));
  return Object.fromEntries(Object.entries(route.legs).filter(([key]) => needed.has(key)));
}

export interface LegJob extends RoadLeg, Costing {
  routeId: string;
}

/** The next routed leg without geometry that has not failed; the routes of the preferred day go first. */
export function nextMissingLeg(routes: readonly Route[], failed: ReadonlySet<string>, preferred: ReadonlySet<string> = new Set()): LegJob | undefined {
  const ordered = [...routes].sort((a, b) => Number(preferred.has(b.id)) - Number(preferred.has(a.id)));
  for (const route of ordered) {
    const leg = routedLegs(route).find((l) => legState(route, l, failed) === 'pending');
    if (leg) return { ...leg, routeId: route.id, profile: route.profile, highways: route.highways };
  }
  return undefined;
}

/** Rounds a coordinate to 6 decimals (about 0.1 m) so keys, URLs and exports agree. */
export function roundLngLat([lng, lat]: LngLat): LngLat {
  return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
}
