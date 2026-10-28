import { entriesOn, type Entry } from '../model/journal';
import type { Trip } from '../model/trip';
import { daySequence } from '../routing/sequence';
import { dayLabel, routeLabel } from './labels';

/** A part of the trip with the journal entries on it, for reading the whole journal top down. */
export interface JournalPart {
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
  if (onTrip.length > 0) parts.push({ kind: 'trip', label: 'On the trip', entries: onTrip });
  trip.days.forEach((day, index) => {
    const ofDay: JournalPart[] = [];
    for (const route of day.routes) {
      const onRoute = entriesOn(entries, { routeId: route.id });
      if (onRoute.length > 0) ofDay.push({ kind: 'route', label: routeLabel(route, day), entries: onRoute });
    }
    const ridden = daySequence(day).flatMap((e) => (e.stop ? [e.stop] : []));
    const stops = [...ridden, ...day.stops.filter((s) => !ridden.includes(s))];
    for (const stop of stops) {
      const onStop = entriesOn(entries, { stopId: stop.id });
      if (onStop.length > 0) ofDay.push({ kind: 'stop', label: stop.name, entries: onStop });
    }
    const onDay = entriesOn(entries, { dayId: day.id });
    if (onDay.length > 0 || ofDay.length > 0) parts.push({ kind: 'day', label: dayLabel(day, index), entries: onDay }, ...ofDay);
  });
  return parts;
}
