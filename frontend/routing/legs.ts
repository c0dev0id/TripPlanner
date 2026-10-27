import { distanceBetween } from '../geo/measure';
import type { LngLat, Profile, Route, RoutedLeg } from '../model/trip';
import { decodePolyline } from './polyline';

/** The key a routed leg's geometry is kept under: profile and both end points (exact coordinates). */
export function legKey(profile: Profile, from: LngLat, to: LngLat): string {
  return `${profile}/${from[0]},${from[1]};${to[0]},${to[1]}`;
}

export interface Leg {
  key: string;
  from: LngLat;
  to: LngLat;
  /** Drawn and exported as the straight line between its ends, never routed. */
  straight: boolean;
}

export type RoutePath = Pick<Route, 'profile' | 'points'>;

/** The legs of a route: one per pair of consecutive points, straight where the second point says so. */
export function routeLegs(route: RoutePath): Leg[] {
  const legs: Leg[] = [];
  for (let i = 1; i < route.points.length; i++) {
    const from = route.points[i - 1]!.lngLat;
    const to = route.points[i]!.lngLat;
    legs.push({ key: legKey(route.profile, from, to), from, to, straight: route.points[i]!.straight === true });
  }
  return legs;
}

/** The legs that are routed, not straight. */
export function routedLegs(route: RoutePath): Leg[] {
  return routeLegs(route).filter((leg) => !leg.straight);
}

/** Routed and straight legs are drawn as part of the route; pending and failed ones wait for routing. */
export type LegState = 'routed' | 'straight' | 'pending' | 'failed';

export function legState(route: Pick<Route, 'legs'>, leg: Leg, failed: ReadonlySet<string>): LegState {
  if (leg.straight) return 'straight';
  if (leg.key in route.legs) return 'routed';
  return failed.has(leg.key) ? 'failed' : 'pending';
}

/** The line of a leg as plain pairs: its routed geometry once it has arrived, the straight line between its ends otherwise. */
export function legCoordinates(route: Pick<Route, 'legs'>, leg: Leg, decode = decodePolyline): LngLat[] {
  const routed = leg.straight ? undefined : route.legs[leg.key];
  return routed
    ? decode(routed.geometry)
    : [
        [leg.from[0], leg.from[1]],
        [leg.to[0], leg.to[1]],
      ];
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
export const ASSUMED_SPEED_MPS = 50 / 3.6;

/** The riding time of a leg in seconds: as routed, or at the assumed pace as the crow flies. */
export function legDuration(route: Pick<Route, 'legs'>, leg: Leg): number {
  const routed = leg.straight ? undefined : route.legs[leg.key];
  return routed ? routed.durationS : distanceBetween(leg.from, leg.to) / ASSUMED_SPEED_MPS;
}

/** The routed legs the route still needs; everything else, straight legs included, is dropped. */
export function pruneLegs(route: RoutePath & Pick<Route, 'legs'>): Record<string, RoutedLeg> {
  const needed = new Set(routedLegs(route).map((l) => l.key));
  return Object.fromEntries(Object.entries(route.legs).filter(([key]) => needed.has(key)));
}

export interface LegJob extends Leg {
  routeId: string;
  profile: Profile;
}

/** The next routed leg without geometry that has not failed; the routes of the preferred day go first. */
export function nextMissingLeg(routes: readonly Route[], failed: ReadonlySet<string>, preferred: ReadonlySet<string> = new Set()): LegJob | undefined {
  const ordered = [...routes].sort((a, b) => Number(preferred.has(b.id)) - Number(preferred.has(a.id)));
  for (const route of ordered) {
    const leg = routeLegs(route).find((l) => legState(route, l, failed) === 'pending');
    if (leg) return { ...leg, routeId: route.id, profile: route.profile };
  }
  return undefined;
}

/** The positions without consecutive repeats, which would make legs of no length. */
export function withoutRepeats(points: readonly LngLat[]): LngLat[] {
  const result: LngLat[] = [];
  for (const p of points) {
    const last = result.at(-1);
    if (!last || last[0] !== p[0] || last[1] !== p[1]) result.push([p[0], p[1]]);
  }
  return result;
}

/** Rounds a coordinate to 6 decimals (about 0.1 m) so keys, URLs and exports agree. */
export function roundLngLat([lng, lat]: LngLat): LngLat {
  return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
}
