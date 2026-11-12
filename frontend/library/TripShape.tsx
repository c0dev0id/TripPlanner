import { createMemo, For } from 'solid-js';
import type { OutlineLine } from '../api';
import { lineColors } from '../model/routeLook';
import { decodePolyline } from '../routing/polyline';
import { routeColoring } from '../state/preferences';

/** The side of the box a shape is drawn in, and the margin its lines keep to the edge. */
const BOX = 40;
const MARGIN = 4;

/**
 * A trip's shape, small: the outlines of its days fitted into a square, each line in the
 * colour its route has on the map.
 */
export function TripShape(props: { days: OutlineLine[][] }) {
  const paths = createMemo(() => {
    const colors = lineColors(props.days, routeColoring());
    const lines = props.days.flatMap((day, d) => day.map((outline, r) => ({ points: decodePolyline(outline.line), color: colors[d]![r]! })));
    const all = lines.flatMap((line) => line.points);
    if (all.length === 0) return [];
    const lats = all.map((p) => p[1]);
    // Degrees of longitude are narrower than those of latitude, the more the farther north.
    const narrow = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180);
    const xs = all.map((p) => p[0] * narrow);
    const [west, north] = [Math.min(...xs), Math.max(...lats)];
    const scale = (BOX - 2 * MARGIN) / Math.max(Math.max(...xs) - west, north - Math.min(...lats), 1e-9);
    const [left, top] = [(BOX - (Math.max(...xs) - west) * scale) / 2, (BOX - (north - Math.min(...lats)) * scale) / 2];
    return lines.map(({ points, color }) => ({
      color,
      d: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(left + (p[0] * narrow - west) * scale).toFixed(1)} ${(top + (north - p[1]) * scale).toFixed(1)}`).join(''),
    }));
  });
  return (
    <svg class="trip-shape" viewBox={`0 0 ${BOX} ${BOX}`} width={BOX} height={BOX} aria-hidden="true">
      <For each={paths()}>{(path) => <path d={path.d} stroke={path.color} />}</For>
    </svg>
  );
}
