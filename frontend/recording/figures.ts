import type { Metric } from './measures';

/** How each measure is named and written. */
export const FIGURES: Record<Metric, { label: string; unit: string; text: (value: number) => string }> = {
  speed: { label: 'Speed', unit: 'km/h', text: (v) => `${Math.round(v)} km/h` },
  altitude: { label: 'Altitude', unit: 'm', text: (v) => `${Math.round(v).toLocaleString()} m` },
  slope: { label: 'Slope', unit: '%', text: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} %` },
  lean: { label: 'Lean angle', unit: '°', text: (v) => `${Math.round(v)}°` },
};

export const METRICS = Object.keys(FIGURES) as Metric[];
