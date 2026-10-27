/** The trip document as the server stores it and the editor works with it. */

/** A position as longitude and latitude in degrees. */
export type LngLat = [number, number];

/** The OSRM profiles the routing server offers; motorcycles ride the car profile. */
export type Profile = 'car' | 'bike' | 'foot';

export const PROFILES: readonly { value: Profile; label: string }[] = [
  { value: 'car', label: 'Road' },
  { value: 'bike', label: 'Bike' },
  { value: 'foot', label: 'Foot' },
];

export type PlaceKind = 'hotel' | 'restaurant' | 'fuel' | 'sight' | 'other';

export type StopRole = 'overnight' | 'lunch' | 'break' | 'fuel' | 'visit' | 'photo';

/** A place kept once per trip and referenced by the stops at it. */
export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  lngLat: LngLat;
  address: string;
  contact: string;
  bookingReference: string;
  notes: string;
}

/** A stop of a day, at a place. */
export interface Stop {
  id: string;
  placeId: string;
  role: StopRole;
  /** Time of day as HH:MM, where the arrival is fixed. */
  arriveAt: string | null;
  pauseMinutes: number | null;
  optional: boolean;
  notes: string;
}

/** A point a route runs through. */
export interface RoutePoint {
  id: string;
  lngLat: LngLat;
  /** The leg from the point before is a straight line rather than routed: for a way the routing does not know. */
  straight?: boolean;
}

/** What the routing answered for a leg: its course as polyline6, its length and its riding time. */
export interface RoutedLeg {
  geometry: string;
  distanceM: number;
  durationS: number;
}

/**
 * The way from a stop to the next stop of the day. The points include both stops'
 * positions as first and last point; the legs between consecutive points are routed, or
 * straight where the point they lead to says so.
 */
export interface Route {
  id: string;
  name: string;
  kind: 'routed' | 'track';
  profile: Profile;
  optional: boolean;
  points: RoutePoint[];
  /** Routed legs keyed by profile and both end points (legKey); straight legs have none. */
  legs: Record<string, RoutedLeg>;
}

export interface Day {
  id: string;
  name: string;
  date: string | null;
  notes: string;
  stops: Stop[];
  /** One route per pair of consecutive stops: routes[i] runs from stops[i] to stops[i + 1]. */
  routes: Route[];
}

export interface Trip {
  id: number;
  name: string;
  description: string;
  startsOn: string | null;
  /** Counts the saves; a save must name the version it started from. */
  version: number;
  places: Place[];
  days: Day[];
}

/** A trip as the library lists it. */
export interface TripSummary {
  id: number;
  name: string;
  startsOn: string | null;
  dayCount: number;
  updatedAt: string;
}

export const newId = (): string => crypto.randomUUID();
