import { t } from '../i18n/t';
import type { EntryTarget } from '../model/journal';
import { PROFILES, takesMotorwayDial, type Day, type Route, type Trip, type TripKind } from '../model/trip';
import { dayOfRoute } from '../routing/dayEdit';
import type { DayTimeline, EntryTime } from '../routing/timeline';
import { counted, distanceText, durationText, shortDateText, timeText } from '../ui/format';

/** A route's name, or its place in the day where it has none. */
export function routeLabel(route: Route, day: Day): string {
  return route.name || t('Route {n}', { n: day.routes.findIndex((r) => r.id === route.id) + 1 });
}

/** A route's label within its trip. */
export function routeLabelOf(trip: Trip, route: Route): string {
  const day = dayOfRoute(trip, route.id);
  return day ? routeLabel(route, day) : route.name;
}

/** A day's number, its date where it has one, and its name. */
export function dayLabel(day: Pick<Day, 'date' | 'name'>, index: number): string {
  return [t('Day {n}', { n: index + 1 }), day.date && shortDateText(day.date), day.name].filter(Boolean).join(' · ');
}

/** A day's label within its trip. */
export const dayLabelOf = (trip: Trip, day: Day): string => dayLabel(day, trip.days.findIndex((d) => d.id === day.id));

/** What a journal entry's part is called: the day, the route or the stop; the trip's name for the trip itself, and nothing for a part the trip no longer holds. */
export function targetLabel(trip: Trip, target: EntryTarget): string | undefined {
  if ('dayId' in target) {
    const day = trip.days.find((d) => d.id === target.dayId);
    return day && dayLabelOf(trip, day);
  }
  if ('stopId' in target) return trip.days.flatMap((d) => d.stops).find((s) => s.id === target.stopId)?.name;
  if ('routeId' in target) {
    const route = trip.days.flatMap((d) => d.routes).find((r) => r.id === target.routeId);
    return route && routeLabelOf(trip, route);
  }
  return trip.name;
}

/** What heads a day in a list: its number and its name, without its date ("Day 2 · Furka"); a collection's section its name alone. */
export const dayHeading = (kind: TripKind, index: number, name: string): string => (kind === 'collection' ? name : [t('Day {n}', { n: index + 1 }), name].filter(Boolean).join(' · '));

/**
 * What a day holds, each kind counted, its stops by what they are there: stops in a trip,
 * waypoints in a collection, places in a list of places. One that holds nothing says so by
 * what it is for.
 */
export function dayHolds(day: { routes: number; stops: number; recordings: number; media: number }, stop: 'stop' | 'waypoint' | 'place'): string {
  const kept = day.recordings + day.media;
  const stops = (day.stops > 0 || (stop === 'place' && day.routes + kept === 0)) && counted(day.stops, stop);
  const routes = (day.routes > 0 || (stop !== 'place' && day.stops + kept === 0)) && counted(day.routes, 'route');
  return [routes, stops, day.recordings > 0 && counted(day.recordings, 'recording'), day.media > 0 && counted(day.media, 'attachment')].filter(Boolean).join(' · ');
}

/**
 * What stands under a day's name: its date and its length; under a section's, what it
 * holds and its length, its waypoints as places in a list of places (`places`).
 */
export function dayDetail(kind: TripKind, day: { date: string | null; routes: number; stops: number; recordings: number; media: number; distanceM: number }, places = false): string {
  const length = day.distanceM > 0 && distanceText(day.distanceM);
  if (kind === 'trip') return [day.date ? shortDateText(day.date) : t('No date'), length].filter(Boolean).join(' · ');
  return [dayHolds(day, places ? 'place' : 'waypoint'), length].filter(Boolean).join(' · ');
}

/** What a day is called within its trip: its label, or in a collection the section's name. */
export const dayTitleOf = (trip: Trip, day: Day): string => (trip.kind === 'collection' ? day.name : dayLabelOf(trip, day));

/** What a route is called by its kind alone, where its profile is not known or does not matter: "Track" or "Route". */
export const routeOrTrack = (kind: Route['kind']): string => (kind === 'track' ? t('Track') : t('Route'));

/** "Track" for a track, else the route's profile (Motorcycle, Bicycle, On foot), and where the motorway dial is turned, how. */
export function routeKindLabel(route: Route): string {
  if (route.kind === 'track') return t('Track');
  const profile = PROFILES.find((p) => p.value === route.profile)?.label ?? route.profile;
  if (!takesMotorwayDial(route.profile) || route.highways === 'allow') return profile;
  return t(route.highways === 'avoid' ? '{profile}, avoid motorways' : '{profile}, prefer motorways', { profile });
}

/** What riding found for a day has in common with it, as its row says: that it began on the day's date, and how much of it ran along the day's routes. */
export const foundBecause = (found: { sameDate: boolean; share: number }): (string | false)[] => [
  found.sameDate && t('on this day'),
  found.share > 0 && t('{share} % along the routes', { share: Math.round(found.share * 100) }),
];

/** Where the ride misses a stop's fixed time: by how much it is late or early, and when it gets there; none where it fits. */
export function offTime(time: EntryTime): { late: boolean; text: string; rideMin: number } | undefined {
  if (time.slackMin === 0) return undefined;
  const late = time.slackMin < 0;
  return { late, text: t(late ? '{time} late' : '{time} early', { time: durationText(Math.abs(time.slackMin) * 60) }), rideMin: time.arrivalMin - time.slackMin };
}

/** The planned arrival, and the departure where a pause separates them. */
export function timesText(time: EntryTime): string {
  const arrival = timeText(time.arrivalMin);
  return time.departureMin > time.arrivalMin ? `${arrival} – ${timeText(time.departureMin)}` : arrival;
}

/** Departure from the first timed stop to the arrival at the end, the riding time, and the pauses where there are any. */
export function timelineText(timeline: DayTimeline): string {
  return [`${timeText(timeline.departMin)} → ${timeText(timeline.endMin)}`, t('{time} riding', { time: durationText(timeline.ridingS) }), timeline.pauseMin > 0 && t('{time} of pauses', { time: durationText(timeline.pauseMin * 60) })]
    .filter(Boolean)
    .join(' · ');
}
