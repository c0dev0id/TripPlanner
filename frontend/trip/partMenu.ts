import { t } from '../i18n/t';
import { FREE_COLOR } from '../model/routeLook';
import { dayOfRoute, dayOfStop, numberedStops, type PartKind } from '../routing/dayEdit';
import { copyParts, heldParts, pasteItems } from '../state/clipboard';
import { setEditTarget, setExportScope, setTrackAction } from '../state/drawing';
import { pinRoutes } from '../state/pins';
import { isPlaceList } from '../state/library';
import { clearPartSelection, partsOfMenu } from '../state/partSelection';
import { duplicateParts, makeRouteOfStops, movePartsToDay, openTrip, removeParts, routeById, setStopSymbols } from '../state/trip';
import { OUR_ICONS, PLAIN_SYMBOL } from '../symbols/symbols';
import type { Held } from '../ui/carry';
import { askConfirmation } from '../ui/confirm';
import { counted } from '../ui/format';
import type { Stop } from '../model/trip';
import { menuNote, type MenuItem } from '../ui/menu';
import { pinItems } from '../ui/Pin';
import { dayTitleOf } from './labels';
import { removeDayAsked, removeRouteAsked } from './remove';
import { autonameRoutes } from './routeNames';

/** What a part is called where its number is told, in a trip and in a list of places. */
export const NOUNS: Record<PartKind, { trip: string; collection: string }> = {
  day: { trip: 'day', collection: 'category' },
  route: { trip: 'route', collection: 'route' },
  stop: { trip: 'stop', collection: 'place' },
};

/**
 * What a drag of a day, a route or a stop holds, and what the label that follows the
 * pointer calls it: the selection where it holds the part, else the part alone, as cut;
 * one by `name`, several by their number.
 */
export function carriedWith(kind: PartKind, id: string, name: string): Held | undefined {
  const ids = partsOfMenu(kind, id);
  return heldParts(ids.length === 1 ? name : counted(ids.length, NOUNS[kind][openTrip()!.kind]), kind, ids);
}

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

/** Icon, with our icons as its submenu, each drawn before its name: the one all the stops have is checked, and a pick gives it to all of them. */
function iconItem(ids: readonly string[]): MenuItem {
  const stops = openTrip()!.days.flatMap((day) => day.stops.filter((stop) => ids.includes(stop.id)));
  return {
    label: t('Icon'),
    items: OUR_ICONS.map(({ label, symbol }) => ({ label, symbol: { name: symbol, color: FREE_COLOR }, checked: stops.every((stop) => (stop.symbol ?? PLAIN_SYMBOL) === symbol), run: () => setStopSymbols(ids, symbol) })),
  };
}

/**
 * Convert, with what a part can be turned into as its submenu: a track into a route; the free stops of a day, or those selected, into a
 * route, for a file that kept a route as waypoints, in the order they are listed or, the
 * numbered ones, by their number. None for a single stop, for several days or routes, in
 * a list of places, or where fewer than two of the stops are free: a stop on a point of a
 * route is part of that route already.
 */
function convertItem(kind: PartKind, ids: readonly string[]): MenuItem[] {
  const trip = openTrip()!;
  const several = ids.length > 1;
  if (isPlaceList(trip.id) || (kind === 'stop' ? !several : several)) return [];
  // Of the routes a track alone is converted.
  if (kind === 'route') {
    return routeById(ids[0]!)?.kind === 'track' ? [{ label: t('Convert'), items: [{ label: t('Track to route…'), run: () => setTrackAction({ routeId: ids[0]!, action: 'convert' }) }] }] : [];
  }
  const day = kind === 'day' ? trip.days.find((d) => d.id === ids[0]) : dayOfStop(trip, ids[0]!);
  const listed = (day?.stops ?? []).filter((stop) => stop.pointId === null && (kind === 'day' || ids.includes(stop.id)));
  // A route is made of two free stops or more: with fewer among what is acted on, there is nothing to offer.
  const by = (label: string, stops: readonly Stop[]): MenuItem[] => (stops.length < 2 ? [] : [{ label: t(label, { n: stops.length }), run: () => makeRouteOfStops(stops.map((stop) => stop.id)) }]);
  const ways = [...by('By order ({n})', listed), ...by('By number ({n})', numberedStops(listed))];
  return ways.length === 0 ? [] : [{ label: t('Convert'), items: [{ label: t(trip.kind === 'trip' ? 'Stops to route' : 'Waypoints to route'), items: ways }] }];
}

/**
 * The menu of a day, a route or a stop of the open trip, the same for each kind and in a
 * trip as in a collection: edit, a stop's icon, a route's name after its ends, duplicate, cut, copy, paste into it, move,
 * export as GPX (days and routes), what only its kind has (`more`), what it converts to, for sections of planning material the trip made of them, for several routes their pins, remove. Opened on a part of a selection it acts on all of
 * them; what takes one part alone is then left out. `edit` stands in where a part is
 * edited otherwise than in its dialog.
 */
export function partMenu(kind: PartKind, id: string, own: { edit?: () => void; more?: MenuItem[] } = {}): MenuItem[] {
  const ids = partsOfMenu(kind, id);
  const several = ids.length > 1;
  const paste = several ? [] : pasteItems(kind, id);
  return [
    ...(several ? [menuNote(t('{what} selected', { what: counted(ids.length, NOUNS[kind][openTrip()!.kind]) }))] : []),
    ...(several ? [] : [{ label: t('Edit…'), run: own.edit ?? (() => setEditTarget({ kind, id })) }]),
    ...(kind === 'stop' ? [iconItem(ids)] : []),
    // Routes and tracks are named after where they begin and end, as rides are.
    ...(kind === 'route' ? [{ label: t('Autoname'), run: () => void autonameRoutes(ids) }] : []),
    { label: t('Duplicate'), run: () => duplicateParts(kind, ids) },
    { label: t('Cut'), run: () => copyParts(kind, ids, true) },
    { label: t('Copy'), run: () => copyParts(kind, ids) },
    // One day or route takes a paste, greyed out while the clipboard holds nothing for it; a stop and several parts take none.
    ...(several || kind === 'stop' ? [] : paste.length > 0 ? paste : [menuNote(t('Paste'))]),
    ...moveItems(kind, ids),
    ...(kind === 'stop' ? [] : [{ label: t('Export GPX…'), run: () => setExportScope({ kind, ids }) }]),
    ...(several ? [] : (own.more ?? [])),
    ...convertItem(kind, ids),
    ...(several && kind === 'route' ? pinItems((pinned) => pinRoutes(ids, pinned)) : []),
    { label: t('Remove'), run: () => void removeAsked(kind, ids) },
  ];
}
