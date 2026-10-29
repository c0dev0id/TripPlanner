import type { Day, Route } from '../model/trip';
import { openTrip, removeDay, removeRoute } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { dayLabelOf, routeLabelOf } from './labels';

/** Removes the day, after asking where routes or stops would go with it; whether it was removed. */
export async function removeDayAsked(day: Day): Promise<boolean> {
  const parts = day.routes.length + day.stops.length;
  if (parts > 0 && !(await askConfirmation(`Remove ${dayLabelOf(openTrip()!, day)} with its routes and stops?`, 'Remove'))) return false;
  removeDay(day.id);
  return true;
}

/** Removes the route, after asking where it has points; whether it was removed. */
export async function removeRouteAsked(route: Route): Promise<boolean> {
  const label = routeLabelOf(openTrip()!, route);
  if (route.points.length > 0 && !(await askConfirmation(`Remove ${label} with its ${route.points.length.toLocaleString()} points?`, 'Remove'))) return false;
  removeRoute(route.id);
  return true;
}
