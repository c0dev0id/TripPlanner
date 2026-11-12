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
    let [west, east, south, north] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const { points } of lines) {
      for (const [lng, lat] of points) {
        west = Math.min(west, lng);
        east = Math.max(east, lng);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      }
    }
    if (west > east) return [];
    // Degrees of longitude are narrower than those of latitude, the more the farther north.
    const narrow = Math.cos((((south + north) / 2) * Math.PI) / 180);
    const [width, height] = [(east - west) * narrow, north - south];
    const scale = (BOX - 2 * MARGIN) / Math.max(width, height, 1e-9);
    const [left, top] = [(BOX - width * scale) / 2, (BOX - height * scale) / 2];
    // One path for each colour: a collection has hundreds of lines and a handful of colours.
    const byColor = new Map<string, string>();
    for (const { points, color } of lines) {
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(left + (p[0] - west) * narrow * scale).toFixed(1)} ${(top + (north - p[1]) * scale).toFixed(1)}`).join('');
      byColor.set(color, (byColor.get(color) ?? '') + d);
    }
    return [...byColor].map(([color, d]) => ({ color, d }));
  });
  return (
    <svg class="trip-shape" viewBox={`0 0 ${BOX} ${BOX}`} width={BOX} height={BOX} aria-hidden="true">
      <For each={paths()}>{(path) => <path d={path.d} stroke={path.color} />}</For>
    </svg>
  );
}
