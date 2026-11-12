import { t } from '../i18n/t';
import { dayOfRoute, dayOfStop, type PartKind } from '../routing/dayEdit';
import { copyParts, pasteItems } from '../state/clipboard';
import { setEditTarget, setExportScope } from '../state/drawing';
import { clearPartSelection, isPartSelected, partsOfMenu, togglePart } from '../state/partSelection';
import { duplicateParts, movePartsToDay, openTrip, removeParts, routeById } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { counted } from '../ui/format';
import type { MenuItem } from '../ui/menu';
import { dayLabel } from './labels';
import { removeDayAsked, removeRouteAsked } from './remove';

/** What a part is called where its number is told, in a trip and in a collection. */
const NOUNS: Record<PartKind, { trip: string; collection: string }> = {
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

/** Move… with the trip's other days as its submenu, for routes and stops; none in a trip of one day. */
function moveItems(kind: PartKind, ids: readonly string[]): MenuItem[] {
  if (kind === 'day') return [];
  const trip = openTrip()!;
  const from = kind === 'route' ? dayOfRoute(trip, ids[0]!) : dayOfStop(trip, ids[0]!);
  const items = trip.days.flatMap((day, index) => (day.id === from?.id ? [] : [{ label: trip.kind === 'collection' ? day.name : dayLabel(day, index), run: () => movePartsToDay(kind, ids, day.id) }]));
  return items.length > 0 ? [{ label: t('Move…'), items }] : [];
}

/**
 * The menu of a day, a route or a stop of the open trip, the same for each kind and in a
 * trip as in a collection: edit, duplicate, cut, copy, paste into it, move, export as GPX
 * (days and routes), what only its kind has (`more`), select, remove. Opened on a part of a selection it acts on all of
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
    { label: t('Duplicate'), run: () => duplicateParts(kind, ids) },
    { label: t('Cut'), run: () => copyParts(kind, ids, true) },
    { label: t('Copy'), run: () => copyParts(kind, ids) },
    ...(paste.length > 0 || kind === 'stop' ? paste : [{ label: t('Paste'), disabled: true, run: nothing }]),
    ...moveItems(kind, ids),
    ...(kind === 'stop' ? [] : [{ label: t('Export GPX…'), run: () => setExportScope({ kind, ids }) }]),
    ...(several ? [] : (own.more ?? [])),
    ...(several || isPartSelected(kind, id) ? [] : [{ label: t('Select'), run: () => togglePart(kind, id) }]),
    { label: t('Remove'), run: () => void removeAsked(kind, ids) },
  ];
}
