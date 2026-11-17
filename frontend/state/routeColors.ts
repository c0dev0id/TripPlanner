import { createMemo, createRoot } from 'solid-js';
import { apartFromRides, routeColors } from '../model/routeLook';
import type { Day } from '../model/trip';
import { routeColoring } from './preferences';
import { isPreviewing } from './recordings';
import { ridesCompared } from './rides';
import { looked, openTrip } from './trip';

const sameColors = (a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): boolean => a.size === b.size && [...a].every(([id, color]) => b.get(id) === color);

/** The colour of each route of some days by its id, apart from the red of rides while some are held against a day; the same map for as long as no colour changes. */
const colorsOf = (days: () => readonly Day[]) =>
  createRoot(() =>
    createMemo(
      () => {
        const colors = routeColors(days(), routeColoring());
        return ridesCompared() || isPreviewing() ? apartFromRides(colors) : colors;
      },
      new Map<string, string>(),
      { equals: sameColors },
    ),
  );

/** The colours of the open trip's routes. */
export const openRouteColors = colorsOf(() => openTrip()?.days ?? []);

/** The colours of the routes of the trip looked at, as the open trip's routes have theirs. */
export const lookColors = colorsOf(() => looked()?.trip.days ?? []);
