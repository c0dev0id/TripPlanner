import type { Day, Route } from '../model/trip';
import { shortDateText } from '../ui/format';

/** A route's name, or its place in the day where it has none. */
export function routeLabel(route: Route, day: Day): string {
  return route.name || `Route ${day.routes.findIndex((r) => r.id === route.id) + 1}`;
}

/** A day's number, its date where the trip has a start date, and its name. */
export function dayLabel(day: Day, index: number, startsOn: string | null): string {
  return [`Day ${index + 1}`, startsOn && shortDateText(startsOn, index), day.name].filter(Boolean).join(' · ');
}
