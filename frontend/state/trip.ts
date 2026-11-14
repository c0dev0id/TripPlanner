import { t } from '../i18n/t';
import { batch, createMemo, createRoot, createSelector, createSignal } from 'solid-js';
import { newId, withChanges, type Day, type LngLat, type Route, type RoutedLeg, type RoutedRoute, type Stop, type Trip } from '../model/trip';
import * as dayEdit from '../routing/dayEdit';
import { roundLngLat } from '../routing/legs';
import * as routeEdit from '../routing/routeEdit';
import { daySequence, type SequenceEntry } from '../routing/sequence';
import { dayTimeline, type DayTimeline } from '../routing/timeline';
import { History } from './history';

/**
 * The open trip, as an immutable value: each edit replaces it with the result of a pure
 * edit, which shares every part it leaves unchanged. All writes go through the actions
 * below: edits with a label are undo steps, every content change counts for the autosave,
 * and positions are rounded here, so that the document never holds a coordinate the leg
 * keys cannot agree on.
 */

const [openTrip, setOpenTrip] = createSignal<Trip>();
export { openTrip };

/** The open trip's id; it changes only when another trip opens, not with each edit. */
export const openTripId: () => number | undefined = createRoot(() => createMemo(() => openTrip()?.id));

const [selectedDayId, setSelectedDayId] = createSignal<string>();
export { selectedDayId };

/** The route taken up, of the selected day; none while the day is only shown. */
const [activeRouteId, setActiveRouteId] = createSignal<string>();
export { activeRouteId };

/** Whether the route is the one taken up; only the rows a change concerns hear of it. */
export const isRouteActive: (id: string) => boolean = createRoot(() => createSelector(activeRouteId));

/** The route being edited: the one taken up, in a trip. A collection's is looked at, not edited. */
export const editingRouteId: () => string | undefined = createRoot(() => createMemo(() => (openTrip()?.kind === 'trip' ? activeRouteId() : undefined)));

/**
 * Whether the mark of the library's tree is in the open trip: on its day that is shown,
 * or on the trip itself where none is. A folder holds it otherwise.
 */
const [markInTrip, setMarkInTrip] = createSignal(true);

/** Whether the day is shown and holds the mark. */
export const isDayMarked = (dayId: string): boolean => markInTrip() && selectedDayId() === dayId;

/** Whether the open trip holds the mark, rather than its day that is shown or a folder. */
export const isTripMarked = (): boolean => markInTrip() && selectedDayId() === undefined;

/** Whether the mark is on the open trip or on its day: not on a folder. */
export const isMarkInTrip = (): boolean => openTrip() !== undefined && markInTrip();

/** Gives the mark to the open trip, which closes its day that is shown. */
export function markTrip(): void {
  batch(() => {
    selectDay(undefined);
    setMarkInTrip(true);
  });
}

/** Gives the mark back to the day that is shown. */
export const markShownDay = (): void => void setMarkInTrip(true);

/** Takes the mark from the open trip and its day, for a folder; both stay open. */
export const markFolder = (): void => void setMarkInTrip(false);

/** Shows a day, which takes the mark, or none; the route taken up is let go. */
export function selectDay(id: string | undefined): void {
  batch(() => {
    setSelectedDayId(id);
    if (id !== undefined) setMarkInTrip(true);
    setActiveRouteId(undefined);
  });
}

/** The selected day; it changes only when that day does. */
export const selectedDay: () => Day | undefined = createRoot(() => createMemo(() => openTrip()?.days.find((d) => d.id === selectedDayId())));

/** The days before and after the selected one. */
export function neighbourDays(): Day[] {
  const days = openTrip()?.days ?? [];
  const index = days.findIndex((d) => d.id === selectedDayId());
  return index < 0 ? [] : [days[index - 1], days[index + 1]].filter((d): d is Day => d !== undefined);
}

/** The selected day's stops and route points in riding order; computed once for the map and the panel. */
export const selectedSequence: () => SequenceEntry[] = createRoot(() =>
  createMemo(() => {
    const day = selectedDay();
    return day ? daySequence(day) : [];
  }),
);

/** The selected day's times, from its first stop with a time on. */
export const selectedTimeline: () => DayTimeline | undefined = createRoot(() => createMemo(() => dayTimeline(selectedSequence())));

/** Takes up a route of the selected day, which in a trip starts editing it, or lets go of the one taken up for undefined. */
export function takeUpRoute(id: string | undefined): void {
  setActiveRouteId(id);
}

/** Shows the route's day and takes the route up. */
export function takeUpRouteOf(dayId: string, routeId: string): void {
  batch(() => {
    if (selectedDayId() !== dayId) selectDay(dayId);
    setActiveRouteId(routeId);
  });
}

/** The route taken up, while its day holds it. */
const activeRoute = (): Route | undefined => selectedDay()?.routes.find((r) => r.id === activeRouteId());

export const editingRoute = (): Route | undefined => (editingRouteId() ? activeRoute() : undefined);

export function routeById(id: string): Route | undefined {
  for (const day of openTrip()?.days ?? []) {
    const route = day.routes.find((r) => r.id === id);
    if (route) return route;
  }
  return undefined;
}

/** Counts the content changes since the trip was loaded; the autosave follows it. */
const [changeCount, setChangeCount] = createSignal(0);
export { changeCount };

/** The trip before each edit; as trips are never changed in place, a step keeps the trip itself. */
const history = new History<Trip>();
const [historyVersion, setHistoryVersion] = createSignal(0);

/** Label of the edit that undo would revert (reactive). */
export function undoLabel(): string | undefined {
  historyVersion();
  return history.undoLabel;
}

/** Label of the edit that redo would repeat (reactive). */
export function redoLabel(): string | undefined {
  historyVersion();
  return history.redoLabel;
}

export function undo(): void {
  const current = openTrip();
  if (current) restore(history.undo(current), current);
}

export function redo(): void {
  const current = openTrip();
  if (current) restore(history.redo(current), current);
}

/** Puts back an earlier trip; the version stays the current one, since saves are no edits. */
function restore(earlier: Trip | undefined, current: Trip): void {
  if (!earlier) return;
  batch(() => {
    setOpenTrip({ ...earlier, version: current.version });
    setHistoryVersion((v) => v + 1);
    setChangeCount((c) => c + 1);
    if (activeRouteId() && !activeRoute()) setActiveRouteId(undefined);
  });
}

/** The open trip as the server has it: as loaded, or as last saved. A save sends what differs from it. */
let saved: Trip | undefined;
export const savedTrip = (): Trip | undefined => saved;

/** Opens a trip as loaded from the server, at the day `dayId` or with none shown; nothing before it can be undone. */
export function loadTrip(loaded: Trip, dayId?: string): void {
  history.clear();
  saved = loaded;
  batch(() => {
    setOpenTrip(loaded);
    setHistoryVersion((v) => v + 1);
    setSelectedDayId(dayId);
    setMarkInTrip(true);
    setActiveRouteId(undefined);
  });
}

export function closeTrip(): void {
  history.clear();
  saved = undefined;
  batch(() => {
    setOpenTrip(undefined);
    setSelectedDayId(undefined);
    setActiveRouteId(undefined);
    setHistoryVersion((v) => v + 1);
  });
}

/** Records that a save stored `sent` as the version given; a save is no change. */
export function markSaved(sent: Trip, version: number): void {
  const current = openTrip();
  if (!current) return;
  saved = sent;
  setOpenTrip({ ...current, version });
}

/** Applies a pure edit to the open trip; with a label it is an undo step. */
function edit(change: (trip: Trip) => Trip, label?: string): void {
  const current = openTrip();
  if (!current) return;
  const next = change(current);
  if (next === current) return;
  batch(() => {
    if (label) {
      history.record(current, label);
      setHistoryVersion((v) => v + 1);
    }
    setOpenTrip(next);
    setChangeCount((c) => c + 1);
  });
}

/** Applies a pure edit to the selected day. */
function editDay(change: (trip: Trip, dayId: string) => Trip, label: string): void {
  const dayId = selectedDayId();
  if (dayId) edit((trip) => change(trip, dayId), label);
}

/** Adds a route to the selected day and takes it up. */
export function addRoute(): void {
  const id = newId();
  editDay((trip, dayId) => dayEdit.addRoute(trip, dayId, id), t('Add route'));
  if (routeById(id)) setActiveRouteId(id);
}

/** Adds routes and stops read from a file to the selected day, as one step. */
export function addParts(parts: { routes: Route[]; stops: Stop[] }): void {
  editDay((trip, dayId) => dayEdit.addParts(trip, dayId, parts), t('Import file'));
}

/** Makes a route of stops of a day, which become its points, as one step to undo. */
export function makeRouteOfStops(stopIds: readonly string[]): void {
  const id = newId();
  edit((trip) => dayEdit.routeFromStops(trip, stopIds, id, newId), t('Make a route of waypoints'));
}

export function removeRoute(routeId: string): void {
  editDay((trip, dayId) => dayEdit.removeRoute(trip, dayId, routeId), t('Remove route'));
  if (activeRouteId() === routeId) setActiveRouteId(undefined);
}

/** Applies a route edit (see routeEdit) to a route; the day's bound stops follow their points. */
function changeRoute(routeId: string, change: (route: Route) => Route, label?: string): void {
  edit((trip) => dayEdit.updateRoute(trip, routeId, change), label);
}

/** Applies an edit of a routed route; a track stays as it is. */
function changeRoutedRoute(routeId: string, change: (route: RoutedRoute) => RoutedRoute, label?: string): void {
  changeRoute(routeId, dayEdit.routedOnly(change), label);
}

/** Leaves out the track's points that keep its line within `toleranceM`. */
export function condenseTrack(routeId: string, toleranceM: number): void {
  changeRoute(routeId, (r) => (r.kind === 'track' ? routeEdit.condenseTrack(r, toleranceM) : r), t('Condense points'));
}

/** Makes a route of the track: its points thinned at `toleranceM`, the legs between them routed along the roads. */
export function convertTrackToRoute(routeId: string, toleranceM: number): void {
  changeRoute(routeId, (r) => (r.kind === 'track' ? routeEdit.trackToRoute(r, toleranceM, newId) : r), t('Convert to route'));
}

/** Changes what a route says about itself; a new profile or motorway dial routes its legs again. */
export function updateRoute(routeId: string, settings: Partial<routeEdit.RouteSettings>): void {
  changeRoute(routeId, (r) => routeEdit.changeSettings(r, settings), t('Edit route'));
}

export function appendPoint(routeId: string, lngLat: LngLat): void {
  changeRoutedRoute(routeId, (r) => routeEdit.appendPoint(r, { id: newId(), lngLat: roundLngLat(lngLat) }), t('Add point'));
}

/** Inserts a point of a route before the one at `index`. */
export function insertPoint(routeId: string, index: number, lngLat: LngLat): void {
  changeRoutedRoute(routeId, (r) => routeEdit.insertPoint(r, index, { id: newId(), lngLat: roundLngLat(lngLat) }), t('Insert point'));
}

export function movePoint(routeId: string, pointId: string, lngLat: LngLat): void {
  changeRoutedRoute(routeId, (r) => routeEdit.movePoint(r, pointId, roundLngLat(lngLat)), t('Move point'));
}

export function removePoint(routeId: string, pointId: string): void {
  changeRoutedRoute(routeId, (r) => routeEdit.removePoint(r, pointId), t('Remove point'));
}

/** Makes the leg that leads to the point straight, or routed again. */
export function setStraight(routeId: string, pointId: string, straight: boolean): void {
  changeRoutedRoute(routeId, (r) => routeEdit.setStraight(r, pointId, straight), t(straight ? 'Straight leg' : 'Routed leg'));
}

/** Stores a routed leg; routing results are no undo steps. */
export function setRouteLeg(routeId: string, key: string, leg: RoutedLeg): void {
  changeRoutedRoute(routeId, (r) => routeEdit.addLeg(r, key, leg));
}

/** Drops a route's routed legs so that they are routed again; undoing it brings the old ones back. */
export function clearLegs(routeId: string): void {
  edit((trip) => dayEdit.clearLegs(trip, routeId), 'Reroute');
}

/** Makes a stop of a route point of the selected day. */
export function convertPoint(pointId: string): void {
  editDay((trip, dayId) => dayEdit.convertPoint(trip, dayId, pointId, newId()), t('Add stop'));
}

/** Inserts a point of a route before the one at `index` and makes a stop of it, as one step. */
export function insertStop(routeId: string, index: number, lngLat: LngLat): void {
  editDay((trip, dayId) => dayEdit.insertStop(trip, dayId, routeId, index, roundLngLat(lngLat), newId(), newId()), t('Add stop'));
}

/** Adds a free stop to the selected day. */
export function addFreeStop(lngLat: LngLat): void {
  editDay((trip, dayId) => dayEdit.addFreeStop(trip, dayId, roundLngLat(lngLat), newId()), t('Add stop'));
}

/** Where the routes of the selected day pass closest to a free stop of it, within reach; none for a stop that stands alone or is bound. */
const nearOf = (stopId: string): SequenceEntry['near'] => selectedSequence().find((e) => e.stop?.id === stopId)?.near;

/** Whether a free stop of the selected day can be bound where its routes pass closest: a track there has no points to bind to. */
export function canConnect(stopId: string): boolean {
  const near = nearOf(stopId);
  return near !== undefined && routeById(near.routeId)?.kind === 'routed';
}

/** Binds a free stop of the selected day to its routes where they pass closest. */
export function connectStop(stopId: string): void {
  const near = nearOf(stopId);
  if (near) editDay((trip, dayId) => dayEdit.connectStop(trip, dayId, stopId, near.routeId, near.legIndex + 1, newId()), t('Connect stop'));
}

export function disconnectStop(stopId: string): void {
  editDay((trip, dayId) => dayEdit.disconnectStop(trip, dayId, stopId), t('Disconnect stop'));
}

export function moveStop(stopId: string, lngLat: LngLat): void {
  editDay((trip, dayId) => dayEdit.moveStop(trip, dayId, stopId, roundLngLat(lngLat)), t('Move stop'));
}

export function removeStop(stopId: string): void {
  editDay((trip, dayId) => dayEdit.removeStop(trip, dayId, stopId), t('Remove stop'));
}

/** Changes what a stop of the selected day says about itself. */
export function updateStop(stopId: string, change: Partial<Omit<Stop, 'id' | 'pointId'>>, label = t('Edit stop')): void {
  editDay((trip, dayId) => dayEdit.updateStop(trip, dayId, stopId, change), label);
}

/** Gives stops of the selected day a symbol, as one step to undo. */
export function setStopSymbols(stopIds: readonly string[], symbol: string): void {
  editDay((trip, dayId) => stopIds.reduce((to, id) => dayEdit.updateStop(to, dayId, id, { symbol }), trip), t('Edit stop'));
}

export function addDay(): void {
  const id = newId();
  edit((trip) => dayEdit.addDay(trip, id), t('Add day'));
  selectDay(id);
}

/** Adds a section of the name to the open collection and shows it. */
export function addSection(name: string): void {
  const id = newId();
  edit((trip) => dayEdit.updateDay(dayEdit.addDay(trip, id), id, (day) => ({ ...day, name })), t('Add section'));
  selectDay(id);
}

/** Adds a place at a position to the section shown, for its dialog to name: the answer is its id. */
export function addPlace(lngLat: LngLat): string {
  const id = newId();
  editDay((trip, dayId) => dayEdit.updateStop(dayEdit.addFreeStop(trip, dayId, roundLngLat(lngLat), id), dayId, id, { name: t('New place') }), t('Add place'));
  return id;
}

/** Moves the day to place `to` among the days. */
export function moveDay(dayId: string, to: number): void {
  edit((trip) => dayEdit.moveDay(trip, dayId, to), t('Move day'));
}

/** Moves the route to place `to` among the routes of its day. */
export function moveRoute(routeId: string, to: number): void {
  edit((trip) => dayEdit.moveRoute(trip, routeId, to), t('Move route'));
}

/** Adds copied routes, with their bound stops, at the end of a day, as one step to undo. */
export function pasteRoutes(dayId: string, copied: readonly dayEdit.CopiedRoute[]): void {
  edit((trip) => copied.reduce((t, c) => dayEdit.pasteRoute(t, dayId, c, newId), trip), t(copied.length > 1 ? 'Paste routes' : 'Paste route'));
}

/** Adds copied stops to a day, free where they stand, as one step to undo. */
export function pasteStops(dayId: string, stops: readonly Stop[]): void {
  edit((trip) => stops.reduce((next, stop) => dayEdit.pasteStop(next, dayId, stop, newId()), trip), t(stops.length > 1 ? 'Paste stops' : 'Paste stop'));
}

/** Adds copied stops to a route, each as a point of it where it passes closest; beside a track, free. */
export function pasteStopsIntoRoute(routeId: string, stops: readonly Stop[]): void {
  edit(
    (trip) => stops.reduce((next, stop) => dayEdit.pasteStopIntoRoute(next, routeId, { ...stop, lngLat: roundLngLat(stop.lngLat) }, newId(), newId()), trip),
    t(stops.length > 1 ? 'Paste stops' : 'Paste stop'),
  );
}

/** Adds copied days, with all they hold, after a day or at the trip's end. */
export function pasteDays(days: readonly Day[], afterId: string | undefined): void {
  edit((trip) => dayEdit.pasteDays(trip, days, afterId, newId), t(days.length > 1 ? 'Paste days' : 'Paste day'));
}

/** Shows no day and takes up no route that an edit took away. */
function leaveWhatIsGone(): void {
  if (selectedDayId() && !selectedDay()) selectDay(undefined);
  else if (activeRouteId() && !activeRoute()) setActiveRouteId(undefined);
}

/** Removes days, routes or stops of the trip, as one step to undo. */
export function removeParts(kind: dayEdit.PartKind, ids: readonly string[]): void {
  edit((trip) => dayEdit.removeParts(trip, kind, ids), t('Remove'));
  leaveWhatIsGone();
}

/** Copies each of the days, routes or stops right after itself, as one step to undo. */
export function duplicateParts(kind: dayEdit.PartKind, ids: readonly string[]): void {
  edit((trip) => dayEdit.duplicateParts(trip, kind, ids, newId), t('Duplicate'));
}

/** Moves routes, with the stops bound to them, or stops, which then stand free, to another day. */
export function movePartsToDay(kind: 'route' | 'stop', ids: readonly string[], dayId: string): void {
  edit((trip) => ids.reduce((next, id) => (kind === 'route' ? dayEdit.moveRouteToDay(next, id, dayId) : dayEdit.moveStopToDay(next, id, dayId)), trip), t(kind === 'route' ? 'Move route' : 'Move stop'));
  leaveWhatIsGone();
}

/** Moves stops onto a route, of their day or another, each as a point of it where it passes closest. */
export function moveStopsIntoRoute(ids: readonly string[], routeId: string): void {
  edit((trip) => ids.reduce((next, id) => dayEdit.moveStopIntoRoute(next, id, routeId, newId()), trip), t('Move stop'));
}

/** Moves days to right after another. */
export function moveDaysAfter(ids: readonly string[], afterId: string): void {
  edit((trip) => dayEdit.moveDaysAfter(trip, ids, afterId), t('Move day'));
}

/** Removes a day; the day before it, or the first, is selected instead. */
export function removeDay(dayId: string): void {
  const days = openTrip()?.days ?? [];
  const index = days.findIndex((d) => d.id === dayId);
  if (index < 0) return;
  edit((trip) => dayEdit.removeDay(trip, dayId), t('Remove day'));
  if (selectedDayId() === dayId) selectDay((days[index - 1] ?? days[index + 1])?.id);
}

/** Changes what a day says about itself: its name, date and notes. */
export function updateDay(dayId: string, change: Pick<Day, 'name' | 'date' | 'notes'>): void {
  edit((trip) => dayEdit.updateDay(trip, dayId, (day) => withChanges(day, change)), t('Edit day'));
}

/** Changes what the trip says about itself: its name, description, and whether it has been ridden. */
export function updateTrip(change: Pick<Trip, 'name' | 'description' | 'state'>): void {
  edit((trip) => withChanges(trip, change), t('Edit trip'));
}
