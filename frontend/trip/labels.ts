import { PROFILES, STOP_KINDS, takesMotorwayDial, type Day, type Route, type StopKind, type Trip } from '../model/trip';
import { dayOfRoute } from '../routing/dayEdit';
import type { DayTimeline, EntryTime } from '../routing/timeline';
import { durationText, shortDateText, timeText } from '../ui/format';

/** A route's name, or its place in the day where it has none. */
export function routeLabel(route: Route, day: Day): string {
  return route.name || `Route ${day.routes.findIndex((r) => r.id === route.id) + 1}`;
}

/** A route's label within its trip. */
export function routeLabelOf(trip: Trip, route: Route): string {
  const day = dayOfRoute(trip, route.id);
  return day ? routeLabel(route, day) : route.name;
}

/** A day's number, its date where it has one, and its name. */
export function dayLabel(day: Pick<Day, 'date' | 'name'>, index: number): string {
  return [`Day ${index + 1}`, day.date && shortDateText(day.date), day.name].filter(Boolean).join(' · ');
}

/** A day's label within its trip. */
export const dayLabelOf = (trip: Trip, day: Day): string => dayLabel(day, trip.days.findIndex((d) => d.id === day.id));

/** What a kind of stop is called; none for a plain stop. */
export const stopKindLabel = (kind: StopKind): string | undefined => (kind === 'other' ? undefined : STOP_KINDS.find((k) => k.value === kind)?.label);

/** "Track" for a track, else the route's profile (Motorcycle, Bicycle, On foot), and where the motorway dial is turned, how. */
export function routeKindLabel(route: Route): string {
  if (route.kind === 'track') return 'Track';
  const profile = PROFILES.find((p) => p.value === route.profile)?.label ?? route.profile;
  if (!takesMotorwayDial(route.profile) || route.highways === 'allow') return profile;
  return route.highways === 'avoid' ? `${profile}, no motorways` : `${profile}, motorways first`;
}

/** Where the ride misses a stop's fixed time: by how much it is late or early, and when it gets there; none where it fits. */
export function offTime(time: EntryTime): { late: boolean; text: string; rideMin: number } | undefined {
  if (time.slackMin === 0) return undefined;
  const late = time.slackMin < 0;
  return { late, text: `${durationText(Math.abs(time.slackMin) * 60)} ${late ? 'late' : 'early'}`, rideMin: time.arrivalMin - time.slackMin };
}

/** The planned arrival, and the departure where a pause separates them. */
export function timesText(time: EntryTime): string {
  const arrival = timeText(time.arrivalMin);
  return time.departureMin > time.arrivalMin ? `${arrival} – ${timeText(time.departureMin)}` : arrival;
}

/** Departure from the first timed stop to the arrival at the end, the riding time, and the pauses where there are any. */
export function timelineText(timeline: DayTimeline): string {
  return [`${timeText(timeline.departMin)} → ${timeText(timeline.endMin)}`, `${durationText(timeline.ridingS)} riding`, timeline.pauseMin > 0 && `${durationText(timeline.pauseMin * 60)} of pauses`]
    .filter(Boolean)
    .join(' · ');
}
