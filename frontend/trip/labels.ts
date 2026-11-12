import { t } from '../i18n/t';
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

/** What heads a day in a list: its number and its name, without its date ("Day 2 · Furka"); a collection's section its name alone. */
export const dayHeading = (kind: TripKind, index: number, name: string): string => (kind === 'collection' ? name : [t('Day {n}', { n: index + 1 }), name].filter(Boolean).join(' · '));

/** What stands under a day's name: its date and its length; under a section's, what it holds and its length. */
export function dayDetail(kind: TripKind, day: { date: string | null; routes: number; stops: number; distanceM: number }): string {
  const length = day.distanceM > 0 && distanceText(day.distanceM);
  const parts = kind === 'collection' ? [counted(day.routes, 'route'), day.stops > 0 && counted(day.stops, 'waypoint'), length] : [day.date ? shortDateText(day.date) : t('No date'), length];
  return parts.filter(Boolean).join(' · ');
}

/** What a day is called within its trip: its label, or in a collection the section's name. */
export const dayTitleOf = (trip: Trip, day: Day): string => (trip.kind === 'collection' ? day.name : dayLabelOf(trip, day));

/** "Track" for a track, else the route's profile (Motorcycle, Bicycle, On foot), and where the motorway dial is turned, how. */
export function routeKindLabel(route: Route): string {
  if (route.kind === 'track') return t('Track');
  const profile = PROFILES.find((p) => p.value === route.profile)?.label ?? route.profile;
  if (!takesMotorwayDial(route.profile) || route.highways === 'allow') return profile;
  return t(route.highways === 'avoid' ? '{profile}, no motorways' : '{profile}, motorways first', { profile });
}

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
