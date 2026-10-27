import type { Day, Route } from '../model/trip';

/** A route's name, or its place in the day where it has none. */
export function routeLabel(route: Route, day: Day): string {
  return route.name || `Route ${day.routes.findIndex((r) => r.id === route.id) + 1}`;
}

/** A day's number with its name. */
export function dayLabel(day: Day, index: number): string {
  return `Day ${index + 1}${day.name ? ` · ${day.name}` : ''}`;
}
