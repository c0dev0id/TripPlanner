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

/** What a stop is, which decides its icon. */
export type StopKind = 'hotel' | 'restaurant' | 'cafe' | 'fuel' | 'sight' | 'photo' | 'break' | 'other';

export const STOP_KINDS: readonly { value: StopKind; label: string }[] = [
  { value: 'other', label: 'Stop' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Café' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'sight', label: 'Sight' },
  { value: 'photo', label: 'Photo spot' },
  { value: 'break', label: 'Break' },
];

/**
 * A point to stop at. Bound to a route point of its day (`pointId`), it stands at that
 * point and moves with it; free, it stands where it is and is ordered by where the route
 * passes closest.
 */
export interface Stop {
  id: string;
  name: string;
  kind: StopKind;
  lngLat: LngLat;
  pointId: string | null;
  address: string;
  contact: string;
  bookingReference: string;
  notes: string;
  /** Time of day as HH:MM, where the arrival is fixed. */
  arriveAt: string | null;
  pauseMinutes: number | null;
  optional: boolean;
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

/** A road to drive: points in order, the legs between consecutive points routed, or straight where the point they lead to says so. */
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
  /** In riding order. */
  routes: Route[];
  stops: Stop[];
}

export interface Trip {
  id: number;
  name: string;
  description: string;
  startsOn: string | null;
  /** Counts the saves; a save must name the version it started from. */
  version: number;
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
