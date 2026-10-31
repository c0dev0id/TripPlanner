import type { Day, Route } from '../model/trip';
import { pointCount } from '../routing/legs';
import { recordingsOf } from '../state/recordings';
import { openTrip, removeDay, removeRoute } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { dayLabelOf, routeLabelOf } from './labels';

/** Removes the day, after asking where routes, stops or recordings would go with it; whether it was removed. */
export async function removeDayAsked(day: Day): Promise<boolean> {
  const recordings = recordingsOf(day.id).length;
  const what = recordings > 0 ? 'routes, stops and recordings' : 'routes and stops';
  if (day.routes.length + day.stops.length + recordings > 0 && !(await askConfirmation(`Remove ${dayLabelOf(openTrip()!, day)} with its ${what}?`, 'Remove'))) return false;
  removeDay(day.id);
  return true;
}

/** Removes the route, after asking where it has points; whether it was removed. */
export async function removeRouteAsked(route: Route): Promise<boolean> {
  const label = routeLabelOf(openTrip()!, route);
  const points = pointCount(route);
  if (points > 0 && !(await askConfirmation(`Remove ${label} with its ${points.toLocaleString()} points?`, 'Remove'))) return false;
  removeRoute(route.id);
  return true;
}
