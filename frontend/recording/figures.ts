import { locale } from '../i18n/language';
import { t } from '../i18n/t';
import { decimalText, distanceText } from '../ui/format';
import type { Delta } from './delta';
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

/** How each difference to what a recording is compared with is named and written, its sign said in words. */
export const DIFFERENCE_FIGURES: Record<keyof Delta, Figure> = {
  offset: { label: t('Apart'), unit: 'm', text: distanceText },
  time: { label: t('Time'), unit: 's', text: (v) => (Math.abs(v) < 0.05 ? t('level') : t(v > 0 ? '{s} s behind' : '{s} s ahead', { s: decimalText(Math.abs(v)) })) },
  speed: { label: t('Speed'), unit: 'km/h', text: (v) => (Math.round(v) === 0 ? t('the same') : t(v > 0 ? '{v} km/h faster' : '{v} km/h slower', { v: Math.abs(Math.round(v)) })) },
  lean: { label: t('Lean'), unit: '°', text: (v) => (Math.round(v) === 0 ? t('the same') : t(v > 0 ? '{v}° further' : '{v}° less', { v: Math.abs(Math.round(v)) })) },
};
