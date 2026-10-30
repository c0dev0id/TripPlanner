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

/** The most characters a name in a trip may have, and any other text in it; the server holds the same limits. */
export const MAX_NAME = 200;
export const MAX_TEXT = 20000;

/** At most `max` characters of the text. */
function clipped(text: string, max: number): string {
  const characters = Array.from(text);
  return characters.length > max ? characters.slice(0, max).join('') : text;
}

/** Text from a file or a path as a name: composed (NFC), one line, at most MAX_NAME characters. */
export const asName = (text: string): string => clipped(text.normalize('NFC').replace(/\s+/g, ' ').trim(), MAX_NAME);

/** Text from a file as notes: composed (NFC), no blanks at the ends of lines, no more than one empty line in a row, at most MAX_TEXT characters. */
export const asNotes = (text: string): string => clipped(text.normalize('NFC').replace(/[^\S\n]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim(), MAX_TEXT);

/** The longest symbol name a stop keeps. */
const MAX_SYMBOL = 100;

/** A waypoint symbol's name from a file: trimmed, at most MAX_SYMBOL characters; null for none. */
export const asSymbol = (text: string | undefined): string | null => text?.trim().slice(0, MAX_SYMBOL) || null;

/**
 * A point to stop at. Bound to a point of a routed route of its day (`pointId`), it stands
 * at that point and moves with it; free, it stands where it is and is ordered by where the
 * routes pass closest.
 */
export interface Stop {
  id: string;
  name: string;
  /** The Garmin waypoint symbol, as a GPX file names it; null for none. Our icons stand for some (see symbols). */
  symbol: string | null;
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

/** What every route has: a track as much as a routed one. */
interface RouteBase {
  id: string;
  name: string;
  /** What it is travelled with; a track made into a route is routed with it. */
  profile: Profile;
  optional: boolean;
}

/** A road to drive: points in order, the legs between consecutive points routed, or straight where the point they lead to says so. */
export interface RoutedRoute extends RouteBase {
  kind: 'routed';
  /** The motorway dial; it counts for the road profile. */
  highways: Highways;
  points: RoutePoint[];
  /** Routed legs keyed by profile, motorway dial and both end points (legKey); straight legs have none. */
  legs: Record<string, RoutedLeg>;
}

/** A line as recorded or drawn elsewhere, kept as it is: its points as one polyline6, none of them a point of its own. */
export interface Track extends RouteBase {
  kind: 'track';
  line: string;
}

export type Route = RoutedRoute | Track;

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

/**
 * A trip to plan and ride, or a collection of planning material: routes and waypoints to
 * look through and copy from, whose days are its sections (a file each) and have no date.
 * Fixed when it is created.
 */
export type TripKind = 'trip' | 'collection';

export interface Trip {
  id: number;
  kind: TripKind;
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
  kind: TripKind;
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
  /** The folder it is in; null at the top of the library. */
  parentId: number | null;
}

export const newId = (): string => crypto.randomUUID();

/** The item with the changes applied, or the same item where every change is already so. */
export function withChanges<T extends object>(item: T, change: NoInfer<Partial<T>>): T {
  return (Object.keys(change) as (keyof T)[]).every((key) => item[key] === change[key]) ? item : { ...item, ...change };
}
