import { createMemo, createRoot } from 'solid-js';
import { routeColors } from '../model/routeLook';
import { routeColoring } from './preferences';
import { openTrip } from './trip';

const sameColors = (a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): boolean => a.size === b.size && [...a].every(([id, color]) => b.get(id) === color);

/** The colour of each route of the open trip by its id; the same map for as long as no colour changes. */
export const openRouteColors = createRoot(() => createMemo(() => routeColors(openTrip()?.days ?? [], routeColoring()), new Map<string, string>(), { equals: sameColors }));
