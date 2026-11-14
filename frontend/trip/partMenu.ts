import { t } from '../i18n/t';
import { FREE_COLOR } from '../map/routeOverlay';
import { dayOfRoute, dayOfStop, numberedStops, type PartKind } from '../routing/dayEdit';
import { copyParts, pasteItems } from '../state/clipboard';
import { setEditTarget, setExportScope, setTrackAction } from '../state/drawing';
import { pinRoutes } from '../state/pins';
import { isPlaceList } from '../state/library';
import { clearPartSelection, isPartSelected, partsOfMenu, togglePart } from '../state/partSelection';
import { duplicateParts, makeRouteOfStops, movePartsToDay, openTrip, removeParts, routeById, setStopSymbols } from '../state/trip';
import { OUR_ICONS, PLAIN_SYMBOL } from '../symbols/symbols';
import { askConfirmation } from '../ui/confirm';
import { counted } from '../ui/format';
import type { Stop } from '../model/trip';
import type { MenuItem } from '../ui/menu';
import { dayTitleOf } from './labels';
import { removeDayAsked, removeRouteAsked } from './remove';

/** What a part is called where its number is told, in a trip and in a collection. */
export const NOUNS: Record<PartKind, { trip: string; collection: string }> = {
  day: { trip: 'day', collection: 'section' },
  route: { trip: 'route', collection: 'route' },
  stop: { trip: 'stop', collection: 'waypoint' },
};

/** Removes the parts: one after the question its kind asks, several after one question for all. */
export async function removeAsked(kind: PartKind, ids: readonly string[]): Promise<void> {
  const trip = openTrip()!;
  const [only] = ids;
  if (ids.length === 1 && kind === 'day') {
    const day = trip.days.find((d) => d.id === only);
    if (day) await removeDayAsked(day);
    return;
  }
  if (ids.length === 1 && kind === 'route') {
    const route = routeById(only!);
    if (route) await removeRouteAsked(route);
    return;
  }
  if (ids.length > 1 && !(await askConfirmation(t('Remove {what}?', { what: counted(ids.length, NOUNS[kind][trip.kind]) }), t('Remove')))) return;
  removeParts(kind, ids);
  clearPartSelection();
}

/** Move… with the open trip's days but `fromDayId` as its submenu, each handing its day to `run`; none in a trip of one day. */
export function moveToDayItem(fromDayId: string | undefined, run: (dayId: string) => void): MenuItem[] {
  const trip = openTrip()!;
  const items = trip.days.filter((day) => day.id !== fromDayId).map((day) => ({ label: dayTitleOf(trip, day), run: () => run(day.id) }));
  return items.length > 0 ? [{ label: t('Move…'), items }] : [];
}

/** Move… for routes and stops, to another day of the trip. */
function moveItems(kind: PartKind, ids: readonly string[]): MenuItem[] {
  if (kind === 'day') return [];
  const trip = openTrip()!;
  const from = kind === 'route' ? dayOfRoute(trip, ids[0]!) : dayOfStop(trip, ids[0]!);
  return moveToDayItem(from?.id, (dayId) => movePartsToDay(kind, ids, dayId));
}

/** The menu items that pin what is selected to the map and let go of it, which `pin` does. */
export function pinItems(pin: (pinned: boolean) => void): MenuItem[] {
  return [
    { label: t('Pin selected to the map'), run: () => pin(true) },
    { label: t('Unpin selected'), run: () => pin(false) },
  ];
}

/** Icon, with our icons as its submenu, each drawn before its name: the one all the stops have is checked, and a pick gives it to all of them. */
function iconItem(ids: readonly string[]): MenuItem {
  const stops = openTrip()!.days.flatMap((day) => day.stops.filter((stop) => ids.includes(stop.id)));
  return {
    label: t('Icon'),
    items: OUR_ICONS.map(({ label, symbol }) => ({ label, symbol: { name: symbol, color: FREE_COLOR }, checked: stops.every((stop) => (stop.symbol ?? PLAIN_SYMBOL) === symbol), run: () => setStopSymbols(ids, symbol) })),
  };
}

/**
 * Convert, with what a part can be turned into as its submenu, greyed out where it does
 * not apply: a track into a route; the free stops of a day, or those selected, into a
 * route, for a file that kept a route as waypoints, in the order they are listed or, the
 * numbered ones, by their number. None for a single stop, for several days or routes, or
 * in a list of places.
 */
function convertItem(kind: PartKind, ids: readonly string[]): MenuItem[] {
  const trip = openTrip()!;
  const several = ids.length > 1;
  if (isPlaceList(trip.id) || (kind === 'stop' ? !several : several)) return [];
  if (kind === 'route') {
    const track = routeById(ids[0]!)?.kind === 'track';
    return [{ label: t('Convert'), items: [{ label: t('Track to route…'), disabled: !track, run: () => setTrackAction({ routeId: ids[0]!, action: 'convert' }) }] }];
  }
  const day = kind === 'day' ? trip.days.find((d) => d.id === ids[0]) : dayOfStop(trip, ids[0]!);
  const listed = (day?.stops ?? []).filter((stop) => stop.pointId === null && (kind === 'day' || ids.includes(stop.id)));
  const numbered = numberedStops(listed);
  const by = (label: string, stops: readonly Stop[]): MenuItem => ({ label: t(label, { n: stops.length }), disabled: stops.length < 2, run: () => makeRouteOfStops(stops.map((stop) => stop.id)) });
  return [{ label: t('Convert'), items: [{ label: t(trip.kind === 'trip' ? 'Stops to route' : 'Waypoints to route'), items: [by('By order ({n})', listed), by('By number ({n})', numbered)] }] }];
}

/**
 * The menu of a day, a route or a stop of the open trip, the same for each kind and in a
 * trip as in a collection: edit, a stop's icon, duplicate, cut, copy, paste into it, move,
 * export as GPX (days and routes), what only its kind has (`more`), what it converts to, for sections of planning material the trip made of them, for several routes their pins, select, remove. Opened on a part of a selection it acts on all of
 * them; what takes one part alone is then greyed out. `edit` stands in where a part is
 * edited otherwise than in its dialog.
 */
export function partMenu(kind: PartKind, id: string, own: { edit?: () => void; more?: MenuItem[] } = {}): MenuItem[] {
  const ids = partsOfMenu(kind, id);
  const several = ids.length > 1;
  const paste = several ? [] : pasteItems(kind, id);
  const nothing = () => undefined;
  return [
    ...(several ? [{ label: t('{what} selected', { what: counted(ids.length, NOUNS[kind][openTrip()!.kind]) }), disabled: true, run: nothing }] : []),
    { label: t('Edit…'), disabled: several, run: own.edit ?? (() => setEditTarget({ kind, id })) },
    ...(kind === 'stop' ? [iconItem(ids)] : []),
    { label: t('Duplicate'), run: () => duplicateParts(kind, ids) },
    { label: t('Cut'), run: () => copyParts(kind, ids, true) },
    { label: t('Copy'), run: () => copyParts(kind, ids) },
    ...(paste.length > 0 || kind === 'stop' ? paste : [{ label: t('Paste'), disabled: true, run: nothing }]),
    ...moveItems(kind, ids),
    ...(kind === 'stop' ? [] : [{ label: t('Export GPX…'), run: () => setExportScope({ kind, ids }) }]),
    ...(several ? [] : (own.more ?? [])),
    ...convertItem(kind, ids),
    ...(several && kind === 'route' ? pinItems((pinned) => pinRoutes(ids, pinned)) : []),
    ...(several || isPartSelected(kind, id) ? [] : [{ label: t('Select'), run: () => togglePart(kind, id) }]),
    { label: t('Remove'), run: () => void removeAsked(kind, ids) },
  ];
}
