import type { LngLat } from '../model/trip';
import type { Measures, Metric } from './measures';

/** What a recording's line can be coloured by: one of its measures, or the surface of the roads under it. */
export type Coloring = Metric | 'surface';

/** From low to high: blue over yellow to red. */
const RISING = ['#2c7bb6', '#00a6ca', '#00ccbc', '#90eb9d', '#f9d057', '#f29e2e', '#e76818', '#d7191c'];
/** From negative (down, to the left) over grey to positive (up, to the right). */
const SIGNED = ['#2166ac', '#4393c3', '#74add1', '#abd9e9', '#bdbdbd', '#fdae61', '#f46d43', '#d73027', '#a50026'];
/** Where a point has no value. */
export const NO_VALUE = '#adb5bd';

/** The range a measure's values spread over and its colours from the low end to the high end. */
export interface Scale {
  from: number;
  to: number;
  colors: readonly string[];
}

/** The value below which the share `p` of the values lie, so that a few wild readings do not stretch a scale. */
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

const up = (value: number, step: number) => Math.ceil(value / step) * step;
const down = (value: number, step: number) => Math.floor(value / step) * step;

/** The scale of a measure over the values of one recording; undefined where it has none. */
export function scaleOf(metric: Metric, values: readonly (number | null)[]): Scale | undefined {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return undefined;
  const widest = (step: number, least: number) => Math.max(least, up(percentile(present.map(Math.abs), 0.98), step));
  switch (metric) {
    case 'speed':
      return { from: 0, to: Math.max(10, up(percentile(present, 0.99), 10)), colors: RISING };
    case 'altitude': {
      const from = down(percentile(present, 0.01), 50);
      return { from, to: Math.max(from + 50, up(percentile(present, 0.99), 50)), colors: RISING };
    }
    case 'slope': {
      const reach = widest(2, 4);
      return { from: -reach, to: reach, colors: SIGNED };
    }
    case 'lean': {
      const reach = widest(5, 10);
      return { from: -reach, to: reach, colors: SIGNED };
    }
  }
}

export function colorAt(scale: Scale, value: number | null): string {
  if (value === null) return NO_VALUE;
  const steps = scale.colors.length;
  const step = Math.floor(((value - scale.from) / (scale.to - scale.from)) * steps);
  return scale.colors[Math.max(0, Math.min(steps - 1, step))]!;
}

/** The road surfaces the routing server tells apart, from smooth asphalt to impassable. */
export const SURFACES: readonly { key: string; label: string; color: string }[] = [
  { key: 'paved_smooth', label: 'Smooth asphalt', color: '#1971c2' },
  { key: 'paved', label: 'Paved', color: '#4dabf7' },
  { key: 'paved_rough', label: 'Rough paved', color: '#9775fa' },
  { key: 'compacted', label: 'Compacted', color: '#f59f00' },
  { key: 'gravel', label: 'Gravel', color: '#e8590c' },
  { key: 'dirt', label: 'Dirt', color: '#a0522d' },
  { key: 'path', label: 'Path', color: '#2f9e44' },
  { key: 'impassable', label: 'Impassable', color: '#e03131' },
];

export const surfaceColor = (surface: string | null): string => SURFACES.find((s) => s.key === surface)?.color ?? NO_VALUE;

/** Kilometres ridden on each surface, a stretch between two points counting for the surface of the first; null for no road matched. */
export function kmBySurface(distance: Float64Array, surfaces: readonly (string | null)[]): Map<string | null, number> {
  const km = new Map<string | null, number>();
  for (let i = 1; i < surfaces.length; i++) {
    const surface = surfaces[i - 1]!;
    km.set(surface, (km.get(surface) ?? 0) + (distance[i]! - distance[i - 1]!) / 1000);
  }
  return km;
}

/** The colour of each point of a line coloured by a measure or, given them, by the surfaces under its points; undefined where it lacks the measure. */
export function lineColors(coloring: Coloring, m: Measures, surfaces?: readonly (string | null)[]): string[] | undefined {
  if (coloring === 'surface') return surfaces?.map(surfaceColor);
  const values = m[coloring];
  const scale = values && scaleOf(coloring, values);
  return scale && values.map((v) => colorAt(scale, v));
}

/** The line in pieces of one colour each, each piece starting where the one before it ends. */
export function colorRuns(points: readonly LngLat[], colors: readonly string[]): { points: LngLat[]; color: string }[] {
  const runs: { points: LngLat[]; color: string }[] = [];
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (colors[i] === colors[start]) continue;
    runs.push({ points: points.slice(start, i + 1), color: colors[start]! });
    start = i;
  }
  if (points.length - start > 1) runs.push({ points: points.slice(start), color: colors[start]! });
  return runs;
}
