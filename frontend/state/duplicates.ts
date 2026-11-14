import { createEffect, createMemo, createResource, createRoot, createSignal } from 'solid-js';
import { duplicateLines, listDuplicates, type DuplicateRoute } from '../api';
import { ROUTE_PALETTE } from '../model/routeLook';
import type { LngLat } from '../model/trip';
import { decodePolyline } from '../routing/polyline';
import { selectionOf } from '../ui/selection';
import { showWhole } from './drawing';
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
  /** Whether the report was ever shown: it is made then, and kept. */
  const asked = createMemo((was: boolean) => was || showingDuplicates(), false);
  /** When the making of the report began, and when the one kept was made. */
  const [startedAt, setStartedAt] = createSignal(0);
  const [madeAt, setMadeAt] = createSignal<number>();
  const [groups, { refetch, mutate }] = createResource(asked, async () => {
    setStartedAt(Date.now());
    const made = await listDuplicates();
    setMadeAt(Date.now());
    return made;
  });
  /** The report's routes by key; none where the report failed, since reading a resource that failed throws. */
  const routes = createMemo(() => new Map((groups.error ? [] : (groups() ?? [])).flatMap((group) => group.routes).map((route) => [duplicateKey(route), route])));

  /** The routes drawn on the map: the selected ones, the first selected first, as many as there are colours to tell them apart; each in the palette's colour at its place. */
  const compared = createMemo(
    () =>
      [...selectionOf(DUPLICATES)]
        .flatMap((key) => routes().get(key) ?? [])
        .slice(0, ROUTE_PALETTE.length),
    undefined,
    { equals: (a, b) => a.length === b.length && a.every((route, i) => route === b[i]) },
  );

  /** The lines of the routes compared, by the route's id, and the ids asked for, arrived or not. Only what is compared is kept: a track is megabytes, and hundreds are looked at in a sitting. */
  const [lines, setLines] = createSignal<ReadonlyMap<string, LngLat[]>>(new Map());
  const requested = new Set<string>();
  createEffect(() => {
    const ids = new Set(compared().map((route) => route.routeId));
    for (const id of requested) if (!ids.has(id)) requested.delete(id);
    setLines((have) => ([...have.keys()].every((id) => ids.has(id)) ? have : new Map([...have].filter(([id]) => ids.has(id)))));
    const missing = [...ids].filter((id) => !requested.has(id));
    if (missing.length === 0) return;
    for (const id of missing) requested.add(id);
    void runLibrary(async () => {
      try {
        const fetched = await duplicateLines(missing);
        // A line that arrives for a route no longer compared is let go.
        const wanted = Object.entries(fetched).filter(([id]) => requested.has(id));
        setLines((have) => new Map([...have, ...wanted.map(([id, line]) => [id, decodePolyline(line)] as const)]));
      } catch (error) {
        for (const id of missing) requested.delete(id);
        throw error;
      }
    });
  });

  /** The lines the map draws, each in its colour, once they are fetched; the same until a drawn line changes. */
  const comparedLines = createMemo(
    () =>
      compared().flatMap((route, id) => {
        const points = lines().get(route.routeId);
        return points ? [{ id, points, color: ROUTE_PALETTE[id]!.color }] : [];
      }),
    undefined,
    { equals: (a, b) => a.length === b.length && a.every((line, i) => line.points === b[i]!.points && line.color === b[i]!.color) },
  );
  // The lines compared are brought into view as they come.
  createEffect(() => {
    let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const { points } of comparedLines()) {
      for (const [lng, lat] of points) {
        west = Math.min(west, lng);
        south = Math.min(south, lat);
        east = Math.max(east, lng);
        north = Math.max(north, lat);
      }
    }
    if (west <= east) showWhole([[west, south], [east, north]]);
  });

  /** Makes the report afresh, and with it the lines, which may have changed too. */
  const refresh = () => {
    requested.clear();
    setLines(new Map());
    void refetch();
  };

  return { groups, startedAt, madeAt, refresh, mutate, compared, comparedLines };
});

/** The groups of the report as last made; none while it is made for the first time. */
export const duplicateGroups = report.groups;

/** When the making of the report began, and when the report kept was made; in milliseconds. */
export const duplicatesStartedAt = report.startedAt;
export const duplicatesMadeAt = report.madeAt;

/** Makes the report afresh. */
export const refreshDuplicates = report.refresh;

/** Takes routes out of the report as it stands, after they were deleted: a group left with one route is none any more, and the groups they were not in stay as they are. */
export function forgetDuplicates(gone: readonly DuplicateRoute[]): void {
  const keys = new Set(gone.map(duplicateKey));
  report.mutate((groups) =>
    groups?.flatMap((group) => {
      if (!group.routes.some((route) => keys.has(duplicateKey(route)))) return [group];
      const routes = group.routes.filter((route) => !keys.has(duplicateKey(route)));
      return routes.length > 1 ? [{ ...group, routes }] : [];
    }),
  );
}

/** The colour a selected route is drawn in on the map; none for one that is not drawn. */
export const comparedColor = (route: DuplicateRoute): string | undefined => ROUTE_PALETTE[report.compared().indexOf(route)]?.color;

/** The lines the map draws to compare the selected routes. */
export const comparedLines = report.comparedLines;
