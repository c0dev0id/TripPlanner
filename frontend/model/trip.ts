/** The trip document as the server stores it and the editor works with it. */

/** A position as longitude and latitude in degrees. */
export type LngLat = [number, number];

/** What a route is travelled with: Valhalla's costings by their names. */
export type Profile = 'motorcycle' | 'bicycle' | 'pedestrian';

export const PROFILES: readonly { value: Profile; label: string }[] = [
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'pedestrian', label: 'On foot' },
];

/** How much a road route takes to motorways: a transfer day prefers them, a loop day avoids them. */
export type Highways = 'avoid' | 'allow' | 'prefer';

export const HIGHWAYS: readonly { value: Highways; label: string }[] = [
  { value: 'avoid', label: 'Avoid' },
  { value: 'allow', label: 'Allow' },
  { value: 'prefer', label: 'Prefer' },
];

/** Whether the motorway dial counts for a profile: the motorcycle costing takes it, the others do not. */
export const takesMotorwayDial = (profile: Profile): boolean => profile === 'motorcycle';

/** What a stop is, which decides its icon. */
export type StopKind = 'start' | 'end' | 'meeting' | 'hotel' | 'restaurant' | 'cafe' | 'fuel' | 'sight' | 'info' | 'photo' | 'break' | 'other';

export const STOP_KINDS: readonly { value: StopKind; label: string }[] = [
  { value: 'other', label: 'Stop' },
  { value: 'start', label: 'Start' },
  { value: 'end', label: 'End' },
  { value: 'meeting', label: 'Meeting point' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Café' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'sight', label: 'Sight' },
  { value: 'info', label: 'Info' },
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

/** A leg's way as polyline6 and its length; its riding time as the routing answered it, or none for a way read from a file. */
export interface RoutedLeg {
  geometry: string;
  distanceM: number;
  durationS: number | null;
}

/** A road to drive: points in order, the legs between consecutive points routed, or straight where the point they lead to says so. */
export interface Route {
  id: string;
  name: string;
  kind: 'routed' | 'track';
  profile: Profile;
  /** The motorway dial; it counts for the road profile. */
  highways: Highways;
  optional: boolean;
  points: RoutePoint[];
  /** Routed legs keyed by profile, motorway dial and both end points (legKey); straight legs have none. */
  legs: Record<string, RoutedLeg>;
}

export interface Day {
  id: string;
  name: string;
  /** As YYYY-MM-DD. */
  date: string | null;
  notes: string;
  /** In riding order. */
  routes: Route[];
  stops: Stop[];
}

/** Planned, or ridden: done. */
export type TripState = 'planned' | 'done';

export interface Trip {
  id: number;
  name: string;
  description: string;
  state: TripState;
  /** Counts the saves; a save must name the version it started from. */
  version: number;
  days: Day[];
}

/** A trip as the library lists it; it starts on its first dated day. */
export interface TripSummary {
  id: number;
  name: string;
  folderId: number | null;
  state: TripState;
  startsOn: string | null;
  dayCount: number;
  updatedAt: string;
}

/** A folder of the library, one level deep. */
export interface Folder {
  id: number;
  name: string;
}

export const newId = (): string => crypto.randomUUID();

/** The item with the changes applied, or the same item where every change is already so. */
export function withChanges<T extends object>(item: T, change: NoInfer<Partial<T>>): T {
  return (Object.keys(change) as (keyof T)[]).every((key) => item[key] === change[key]) ? item : { ...item, ...change };
}
