import type { Day, Route } from '../model/trip';

/** A route's name, or its place in the day where it has none. */
export function routeLabel(route: Route, day?: Day): string {
  if (route.name) return route.name;
  const index = day ? day.routes.findIndex((r) => r.id === route.id) : -1;
  return index >= 0 ? `Route ${index + 1}` : 'Route';
}

/** A day's number with its name. */
export function dayLabel(day: Day, index: number): string {
  return `Day ${index + 1}${day.name ? ` · ${day.name}` : ''}`;
}
