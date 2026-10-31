import { distanceText } from '../ui/format';
import type { Delta } from './delta';
import type { Metric } from './measures';

export type Figure = { label: string; unit: string; text: (value: number) => string };

/** How each measure is named and written. */
export const FIGURES: Record<Metric, Figure> = {
  speed: { label: 'Speed', unit: 'km/h', text: (v) => `${Math.round(v)} km/h` },
  altitude: { label: 'Altitude', unit: 'm', text: (v) => `${Math.round(v).toLocaleString()} m` },
  slope: { label: 'Slope', unit: '%', text: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} %` },
  lean: { label: 'Lean angle', unit: '°', text: (v) => `${Math.round(v)}°` },
};

export const METRICS = Object.keys(FIGURES) as Metric[];

/** How each difference to what a recording is compared with is named and written, its sign said in words. */
export const DIFFERENCE_FIGURES: Record<keyof Delta, Figure> = {
  offset: { label: 'Apart', unit: 'm', text: distanceText },
  time: { label: 'Time', unit: 's', text: (v) => (Math.abs(v) < 0.05 ? 'level' : `${Math.abs(v).toFixed(1)} s ${v > 0 ? 'behind' : 'ahead'}`) },
  speed: { label: 'Speed', unit: 'km/h', text: (v) => (Math.round(v) === 0 ? 'the same' : `${Math.abs(Math.round(v))} km/h ${v > 0 ? 'faster' : 'slower'}`) },
  lean: { label: 'Lean', unit: '°', text: (v) => (Math.round(v) === 0 ? 'the same' : `${Math.abs(Math.round(v))}° ${v > 0 ? 'further' : 'less'}`) },
};
