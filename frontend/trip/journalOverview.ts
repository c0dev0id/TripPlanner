import { entriesOn, type Entry } from '../model/journal';
import type { Trip } from '../model/trip';
import { withStopsInRidingOrder } from '../routing/sequence';
import { dayLabel, routeLabel } from './labels';

/** A part of the trip with the journal entries on it, for reading the whole journal top down. */
export interface JournalPart {
  /** The part's id; the trip's part is 'trip'. */
  id: string;
  kind: 'trip' | 'day' | 'route' | 'stop';
  label: string;
  entries: Entry[];
}

/**
 * The trip's journal in the trip's order: the entries on the trip itself, then each day
 * with its own entries, its routes' and its stops' in riding order. A day without an
 * entry anywhere on it is left out, as is a route or a stop without one.
 */
export function journalOverview(trip: Trip, entries: readonly Entry[]): JournalPart[] {
  const parts: JournalPart[] = [];
  const onTrip = entriesOn(entries, {});
  if (onTrip.length > 0) parts.push({ id: 'trip', kind: 'trip', label: 'On the trip', entries: onTrip });
  withStopsInRidingOrder(trip).days.forEach((day, index) => {
    const ofDay: JournalPart[] = [];
    for (const route of day.routes) {
      const onRoute = entriesOn(entries, { routeId: route.id });
      if (onRoute.length > 0) ofDay.push({ id: route.id, kind: 'route', label: routeLabel(route, day), entries: onRoute });
    }
    for (const stop of day.stops) {
      const onStop = entriesOn(entries, { stopId: stop.id });
      if (onStop.length > 0) ofDay.push({ id: stop.id, kind: 'stop', label: stop.name, entries: onStop });
    }
    const onDay = entriesOn(entries, { dayId: day.id });
    if (onDay.length > 0 || ofDay.length > 0) parts.push({ id: day.id, kind: 'day', label: dayLabel(day, index), entries: onDay }, ...ofDay);
  });
  return parts;
}
