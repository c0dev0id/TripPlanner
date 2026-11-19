import { locale } from '../i18n/language';
import { t } from '../i18n/t';
import type { Day, Route } from '../model/trip';
import { stopsOf } from '../routing/dayEdit';
import { pointCount } from '../routing/legs';
import { mediaOf } from '../state/media';
import { recordingsOf } from '../state/recordings';
import { openTrip, removeDay, removeRoute } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { counted } from '../ui/format';
import { dayLabelOf, routeLabelOf } from './labels';

/** Removes the day, after asking where routes, stops or media would go with it, or rides would be taken off it, which stay rides; whether it was removed. */
export async function removeDayAsked(day: Day): Promise<boolean> {
  const kept = recordingsOf(day.id).length + mediaOf(day.id).length;
  const question = t(kept > 0 ? 'Remove {day} with its routes, stops and media? Its recordings stay in Recordings.' : 'Remove {day} with its routes and stops?', { day: dayLabelOf(openTrip()!, day) });
  if (day.routes.length + day.stops.length + kept > 0 && !(await askConfirmation(question, t('Remove')))) return false;
  removeDay(day.id);
  return true;
}

/** Removes the route with its stops, after asking where it has points or stops; whether it was removed. */
export async function removeRouteAsked(route: Route): Promise<boolean> {
  const label = routeLabelOf(openTrip()!, route);
  const points = pointCount(route);
  const stops = openTrip()!.days.flatMap((day) => stopsOf(route, day.stops)).length;
  const withStops = stops > 0 ? t('Remove {route} with its {n} points and {stops}?', { route: label, n: points.toLocaleString(locale), stops: counted(stops, 'stop') }) : t('Remove {route} with its {n} points?', { route: label, n: points.toLocaleString(locale) });
  if (points + stops > 0 && !(await askConfirmation(withStops, t('Remove')))) return false;
  removeRoute(route.id);
  return true;
}
