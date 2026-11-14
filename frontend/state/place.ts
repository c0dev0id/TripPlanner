/**
 * Where the user is in the planner, kept in the address's fragment so that loading the page
 * again comes back to it: the folder shown, whether the rides are shown in the library's
 * place, the open trip, its selected day and the route being edited. The map keeps its
 * own view there, as `map=`.
 */
export interface Place {
  /** The folder the explorer shows, null for the top. */
  folderId: number | null;
  /** Whether the library shows the rides instead of a tree. */
  recordings?: boolean;
  tripId?: number;
  dayId?: string;
  routeId?: string;
}

const KEYS = ['folder', 'view', 'trip', 'day', 'route'];

/** The place a fragment names; what it does not name, or names badly, is left out. */
export function readPlace(fragment: string): Place {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const id = (key: string) => (/^\d+$/.test(params.get(key) ?? '') ? Number(params.get(key)) : undefined);
  const [tripId, dayId, routeId] = [id('trip'), params.get('day') || undefined, params.get('route') || undefined];
  return { folderId: id('folder') ?? null, ...(params.get('view') === 'recordings' && { recordings: true }), ...(tripId !== undefined && { tripId, ...(dayId && { dayId, ...(routeId && { routeId }) }) }) };
}

/** The fragment with the place written into it, empty for the top with nothing else; whatever else it holds, such as the map's view, stays as it is. */
export function withPlace(fragment: string, place: Place): string {
  const others = fragment
    .replace(/^#/, '')
    .split('&')
    .filter((part) => part !== '' && !KEYS.includes(part.split('=')[0]!));
  const own = [
    ['folder', place.folderId],
    ['view', place.recordings ? 'recordings' : undefined],
    ['trip', place.tripId],
    ['day', place.dayId],
    ['route', place.routeId],
  ].flatMap(([key, value]) => (value === null || value === undefined ? [] : [`${key}=${encodeURIComponent(value)}`]));
  const parts = [...own, ...others];
  return parts.length > 0 ? `#${parts.join('&')}` : '';
}

/** The trip the address named together with a view of the map, until the map has shown it. */
let tripWithView: number | undefined;

/** Has the map stay at the view its address names when it first shows the trip, where it would show a day whole. */
export function keepViewOf(tripId: number): void {
  tripWithView = tripId;
}

/** Whether the map keeps its view for this showing of the trip: once, for the trip `keepViewOf` named. */
export function keepsView(tripId: number | undefined): boolean {
  const keeps = tripId !== undefined && tripId === tripWithView;
  if (keeps) tripWithView = undefined;
  return keeps;
}
