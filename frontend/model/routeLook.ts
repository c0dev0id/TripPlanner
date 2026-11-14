import { t } from '../i18n/t';
import type { Day } from './trip';

/** How route lines look: the colours they are drawn in and their width. */

/** The colours of route lines, in the order they are given out; none is one a road, a closure or roadworks are drawn in. */
export const ROUTE_PALETTE: readonly { color: string; label: string }[] = [
  { color: '#c2255c', label: t('Magenta') },
  { color: '#1c7ed6', label: t('Blue') },
  { color: '#5f3dc4', label: t('Violet') },
  { color: '#0c8599', label: t('Teal') },
  { color: '#2f9e44', label: t('Green') },
  { color: '#e8590c', label: t('Orange') },
  { color: '#7f4f24', label: t('Brown') },
  { color: '#212529', label: t('Black') },
];

/** The colour of rides held against a day they may be of, so that they are told apart from its routes: a red no route is given. */
export const COMPARED_RIDE_COLOR = '#e03131';

/** The colours of routes while rides are held against them: the palette's magenta, which reads as that red, gives way to its blue. */
export const apartFromRides = (colors: ReadonlyMap<string, string>): Map<string, string> => new Map([...colors].map(([id, color]) => [id, color === ROUTE_PALETTE[0]!.color ? ROUTE_PALETTE[1]!.color : color]));

/** How routes without a colour of their own get one: one per day, or one per route. */
export type RouteColoring = 'day' | 'route';
export const DEFAULT_ROUTE_COLORING: RouteColoring = 'day';

/** The width of a route's line at the zooms a trip is planned at, in pixels, and the range it can be set in. */
export const DEFAULT_ROUTE_WIDTH = 5;
export const ROUTE_WIDTHS = { min: 2, max: 12 };

/**
 * The colour of each route of the days by its id: its own where it has one, else the
 * palette's colour at the place of its day in the trip or, colouring by route, at its own
 * place among the trip's routes; the palette starts over where it ends.
 */
export function routeColors(days: readonly Day[], coloring: RouteColoring): Map<string, string> {
  const colors = lineColors(days.map((day) => day.routes), coloring);
  return new Map(days.flatMap((day, d) => day.routes.map((route, r): [string, string] => [route.id, colors[d]![r]!])));
}

/** The colour the routes of the day at place `index` get where each day has one; none where each route gets its own. */
export const dayColor = (index: number, coloring: RouteColoring): string | undefined => (coloring === 'day' ? ROUTE_PALETTE[index % ROUTE_PALETTE.length]!.color : undefined);

/** The colours of lines given day by day, each with the colour of its own or none: as routeColors gives them to routes. */
export function lineColors(days: readonly (readonly { color: string | null }[])[], coloring: RouteColoring): string[][] {
  let place = 0;
  return days.map((lines, dayIndex) => lines.map((line) => line.color ?? dayColor(dayIndex, coloring) ?? ROUTE_PALETTE[place++ % ROUTE_PALETTE.length]!.color));
}

/** How opaque one ride is where the map draws them all, from 0 to 1: translucent enough that a few rides on a road still read as fewer than many. */
export const DEFAULT_RIDES_OPACITY = 0.4;
