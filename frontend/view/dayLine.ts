import type { Day } from '../model/trip';
import { routePositions } from '../routing/legs';

/** How many positions of a day's routes its small line is drawn from, at most. */
const MAX_POINTS = 240;

/**
 * A day's routes as the path of a small drawing that fits a box of the size given, north
 * up, a degree of longitude as wide as it is at the day's latitude. Empty for a day
 * without a route that goes anywhere.
 */
export function dayLinePath(day: Day, width: number, height: number): string {
  const lines = day.routes.map((route) => routePositions(route)).filter((line) => line.length > 1);
  const all = lines.flat();
  if (all.length === 0) return '';
  const [west, east] = [Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0]))];
  const [south, north] = [Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[1]))];
  const narrow = Math.cos(((south + north) / 2) * (Math.PI / 180));
  const scale = Math.min(width / Math.max((east - west) * narrow, 1e-9), height / Math.max(north - south, 1e-9));
  const [left, top] = [(width - (east - west) * narrow * scale) / 2, (height - (north - south) * scale) / 2];
  const every = Math.max(1, Math.ceil(all.length / MAX_POINTS));
  return lines
    .map((line) =>
      line
        .filter((_, i) => i % every === 0 || i === line.length - 1)
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${(left + (p[0] - west) * narrow * scale).toFixed(1)} ${(top + (north - p[1]) * scale).toFixed(1)}`)
        .join(''),
    )
    .join('');
}
