import { createEffect, createMemo, createResource, createRoot, createSignal } from 'solid-js';
import { duplicateLines, listDuplicates, type DuplicateRoute } from '../api';
import { ROUTE_PALETTE } from '../model/routeLook';
import type { LngLat } from '../model/trip';
import { decodePolyline } from '../routing/polyline';
import { selectionOf } from '../ui/selection';
import { runLibrary, showingDuplicates } from './library';

/**
 * The duplicates report: made when it is first shown and kept while the page stands, so
 * that it is there at once when it is shown again, and the lines of the routes selected
 * in it, which the map draws to compare them.
 */

/** The owner of the report's selection. */
export const DUPLICATES = 'duplicates';

/** A route of the report by its trip and its id: a route is listed once, in whatever groups it is. */
export const duplicateKey = (route: DuplicateRoute): string => `${route.tripId}/${route.routeId}`;

const report = createRoot(() => {
  const [asked, setAsked] = createSignal(false);
  createEffect(() => showingDuplicates() && setAsked(true));
  const [groups, { refetch, mutate }] = createResource(asked, listDuplicates);

  /** The routes drawn on the map with their colours: the selected ones, the first selected first, as many as there are colours to tell them apart. */
  const compared = createMemo(() => {
    // Reading a resource that failed throws; there is nothing to compare then.
    const routes = new Map((groups.error ? [] : (groups() ?? [])).flatMap((group) => group.routes).map((route) => [duplicateKey(route), route]));
    return [...selectionOf(DUPLICATES).keys]
      .flatMap((key) => routes.get(key) ?? [])
      .slice(0, ROUTE_PALETTE.length)
      .map((route, i) => ({ route, color: ROUTE_PALETTE[i]!.color }));
  });

  /** The lines of routes as fetched, by the route's id; a route is asked for once. */
  const [lines, setLines] = createSignal<ReadonlyMap<string, LngLat[]>>(new Map());
  const requested = new Set<string>();
  createEffect(() => {
    const missing = compared()
      .map(({ route }) => route.routeId)
      .filter((id) => !requested.has(id));
    if (missing.length === 0) return;
    for (const id of missing) requested.add(id);
    void runLibrary(async () => {
      const found = await duplicateLines(missing);
      setLines((have) => new Map([...have, ...Object.entries(found).map(([id, line]) => [id, decodePolyline(line)] as const)]));
    });
  });

  return { groups, refetch, mutate, compared, lines };
});

/** The groups of the report as last made; none while it is made for the first time. */
export const duplicateGroups = report.groups;

/** Makes the report afresh. */
export const refreshDuplicates = (): void => void report.refetch();

/** Takes routes out of the report as it stands, after they were deleted: a group left with one route is none any more. */
export function forgetDuplicates(gone: readonly DuplicateRoute[]): void {
  const keys = new Set(gone.map(duplicateKey));
  report.mutate((groups) => groups?.map((group) => ({ ...group, routes: group.routes.filter((route) => !keys.has(duplicateKey(route))) })).filter((group) => group.routes.length > 1));
}

/** The colour a selected route is drawn in on the map; none for one that is not drawn. */
export const comparedColor = (route: DuplicateRoute): string | undefined => report.compared().find((c) => c.route === route)?.color;

/** The lines the map draws to compare the selected routes, each in its colour, once they are fetched. */
export const comparedLines = createRoot(() =>
  createMemo(() =>
    report.compared().flatMap(({ route, color }, id) => {
      const points = report.lines().get(route.routeId);
      return points ? [{ id, points, color }] : [];
    }),
  ),
);
