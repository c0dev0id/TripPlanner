import { PROFILES, takesMotorwayDial, type Day, type Route } from '../model/trip';
import type { DayTimeline, EntryTime } from '../routing/timeline';
import { durationText, shortDateText, timeText } from '../ui/format';

/** A route's name, or its place in the day where it has none. */
export function routeLabel(route: Route, day: Day): string {
  return route.name || `Route ${day.routes.findIndex((r) => r.id === route.id) + 1}`;
}

/** A day's number, its date where it has one, and its name. */
export function dayLabel(day: Day, index: number): string {
  return [`Day ${index + 1}`, day.date && shortDateText(day.date), day.name].filter(Boolean).join(' · ');
}

/** "Track" for a track, else the route's profile (Road, Bike, Foot), and where the motorway dial is turned, how. */
export function routeKindLabel(route: Route): string {
  if (route.kind === 'track') return 'Track';
  const profile = PROFILES.find((p) => p.value === route.profile)?.label ?? route.profile;
  if (!takesMotorwayDial(route.profile) || route.highways === 'allow') return profile;
  return route.highways === 'avoid' ? `${profile}, no motorways` : `${profile}, motorways first`;
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
