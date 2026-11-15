import { locale } from '../i18n/language';
import { t } from '../i18n/t';
import { decimalText, distanceText } from '../ui/format';
import type { DeltaSeries } from './delta';
import type { Metric } from './measures';

export type Figure = { label: string; unit: string; text: (value: number) => string };

/** How each measure is named and written. */
export const FIGURES: Record<Metric, Figure> = {
  speed: { label: t('Speed'), unit: 'km/h', text: (v) => `${Math.round(v)} km/h` },
  altitude: { label: t('Altitude'), unit: 'm', text: (v) => `${Math.round(v).toLocaleString(locale)} m` },
  slope: { label: t('Slope'), unit: '%', text: (v) => `${v > 0 ? '+' : ''}${decimalText(v)} %` },
  lean: { label: t('Lean angle'), unit: '°', text: (v) => `${Math.round(v)}°` },
};

export const METRICS = Object.keys(FIGURES) as Metric[];

/** A whole number with its sign: + for more than the other, − for less, ± for the same. */
const signed = (v: number): string => {
  const whole = Math.round(v);
  return `${whole > 0 ? '+' : whole < 0 ? '−' : '±'}${Math.abs(whole).toLocaleString(locale)}`;
};

/** How each difference to what a recording is compared with is named and written: the distance from it, the time in words, speed and lean with their signs. */
export const DIFFERENCE_FIGURES: Record<DeltaSeries, Figure> = {
  offset: { label: t('Distance'), unit: 'm', text: distanceText },
  time: { label: t('Time'), unit: 's', text: (v) => (Math.abs(v) < 0.05 ? t('level') : t(v > 0 ? '{s} s behind' : '{s} s ahead', { s: decimalText(Math.abs(v)) })) },
  speed: { label: t('Speed'), unit: 'km/h', text: (v) => `${signed(v)} km/h` },
  lean: { label: t('Lean'), unit: '°', text: (v) => `${signed(v)}°` },
};
