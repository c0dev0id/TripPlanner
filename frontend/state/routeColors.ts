import { createMemo, createRoot } from 'solid-js';
import { apartFromRides, routeColors } from '../model/routeLook';
import { routeColoring } from './preferences';
import { isPreviewing } from './recordings';
import { ridesCompared } from './rides';
import { openTrip } from './trip';

const sameColors = (a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): boolean => a.size === b.size && [...a].every(([id, color]) => b.get(id) === color);

/** The colour of each route of the open trip by its id, apart from the red of rides while some are held against a day; the same map for as long as no colour changes. */
export const openRouteColors = createRoot(() =>
  createMemo(
    () => {
      const colors = routeColors(openTrip()?.days ?? [], routeColoring());
      return ridesCompared() || isPreviewing() ? apartFromRides(colors) : colors;
    },
    new Map<string, string>(),
    { equals: sameColors },
  ),
);
