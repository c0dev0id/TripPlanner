import { distanceBetween, lineLength } from '../geo/measure';
import type { LngLat, Route, RoutedLeg, RoutedRoute } from '../model/trip';
import { decodeCached } from './polyline';

/** What a leg is routed with: the profile and the motorway dial. */
export type Costing = Pick<RoutedRoute, 'profile' | 'highways'>;

/** The key a routed leg's geometry is kept under: the costing and both end points (exact coordinates). */
export function legKey(costing: Costing, from: LngLat, to: LngLat): string {
  return `${costing.profile}:${costing.highways}/${from[0]},${from[1]};${to[0]},${to[1]}`;
}

/** A leg drawn and exported as the straight line between its ends, never routed. */
export interface StraightLeg {
  kind: 'straight';
  from: LngLat;
  to: LngLat;
}

/** A leg routed along the roads, its geometry kept under its key. */
export interface RoadLeg {
  kind: 'road';
  from: LngLat;
  to: LngLat;
  key: string;
}

/** A track's line, which is its one leg, never routed. */
export interface TrackLeg {
  kind: 'track';
  line: string;
}

export type Leg = StraightLeg | RoadLeg | TrackLeg;

/** The legs of a route: one per pair of consecutive points, straight where the second point says so; a track's line as one. */
export function routeLegs(route: Route): Leg[] {
  if (route.kind === 'track') return [{ kind: 'track', line: route.line }];
  const legs: Leg[] = [];
  for (let i = 1; i < route.points.length; i++) {
    const from = route.points[i - 1]!.lngLat;
    const to = route.points[i]!.lngLat;
    legs.push(route.points[i]!.straight === true ? { kind: 'straight', from, to } : { kind: 'road', from, to, key: legKey(route, from, to) });
  }
  return legs;
}

/** The legs that are routed along the roads. */
export function routedLegs(route: Route): RoadLeg[] {
  return routeLegs(route).filter((leg): leg is RoadLeg => leg.kind === 'road');
}

/** The routing's answer for a leg, where it has arrived. */
function routedLeg(route: Route, leg: Leg): RoutedLeg | undefined {
  return leg.kind === 'road' && route.kind === 'routed' ? route.legs[leg.key] : undefined;
}

/** Routed, straight and track legs are drawn as part of the route; pending and failed ones wait for routing. */
export type LegState = 'routed' | 'straight' | 'track' | 'pending' | 'failed';

export function legState(route: Route, leg: Leg, failed: ReadonlySet<string>): LegState {
  if (leg.kind !== 'road') return leg.kind;
  if (routedLeg(route, leg)) return 'routed';
  return failed.has(leg.key) ? 'failed' : 'pending';
}

/** The line of a leg: a track's line, its routed geometry once it has arrived, the straight line between its ends otherwise. */
export function legCoordinates(route: Route, leg: Leg, decode = decodeCached): LngLat[] {
  if (leg.kind === 'track') return decode(leg.line);
  const routed = routedLeg(route, leg);
  return routed ? decode(routed.geometry) : [leg.from, leg.to];
}

/** The length of a leg in metres: along a track, as routed, or as the crow flies for a straight leg or one not routed yet. */
export function legDistance(route: Route, leg: Leg): number {
  if (leg.kind === 'track') return lineLength(decodeCached(leg.line));
  const routed = routedLeg(route, leg);
  return routed ? routed.distanceM : distanceBetween(leg.from, leg.to);
}

/** The length of a route in metres, legs not routed yet counted as the crow flies. */
export function routeDistance(route: Route): number {
  return routeLegs(route).reduce((sum, leg) => sum + legDistance(route, leg), 0);
}

/** The length of routes together in metres, such as a day's. */
export const routesDistance = (routes: readonly Route[]): number => routes.reduce((sum, route) => sum + routeDistance(route), 0);

/** How many points a route has: those it runs through, or a track's along its line. */
export function pointCount(route: Route): number {
  return route.kind === 'track' ? decodeCached(route.line).length : route.points.length;
}

/** The positions a route spans: its points, or a track's line. */
export function routePositions(route: Route): LngLat[] {
  return route.kind === 'track' ? decodeCached(route.line) : route.points.map((p) => p.lngLat);
}

/** The pace assumed for a leg the routing has not timed: a track, a straight one, one not routed yet, or one imported with its way. */
const ASSUMED_SPEED_MPS = 50 / 3.6;

/** The riding time of a leg in seconds: as routed, or at the assumed pace along its line, its way or, without one, as the crow flies. */
export function legDuration(route: Route, leg: Leg): number {
  const routed = routedLeg(route, leg);
  if (!routed) return legDistance(route, leg) / ASSUMED_SPEED_MPS;
  return routed.durationS ?? routed.distanceM / ASSUMED_SPEED_MPS;
}

/** The routed legs the route still needs; everything else, straight legs included, is dropped. */
export function pruneLegs(route: RoutedRoute): Record<string, RoutedLeg> {
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
    if (route.kind !== 'routed') continue;
    const leg = routedLegs(route).find((l) => legState(route, l, failed) === 'pending');
    if (leg) return { ...leg, routeId: route.id, profile: route.profile, highways: route.highways };
  }
  return undefined;
}

/** Rounds a coordinate to 6 decimals (about 0.1 m) so keys, URLs and exports agree. */
export function roundLngLat([lng, lat]: LngLat): LngLat {
  return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
}
