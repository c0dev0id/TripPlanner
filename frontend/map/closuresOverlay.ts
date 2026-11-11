import motorcycle from '@rapideditor/temaki/icons/motorcycle.svg?raw';
import { t } from '../i18n/t';
import { svgInlay } from './mapImages';
import type { Overlay } from './overlays';
import { ring, sign, SIGN_RED, signSize } from './overlaySigns';
import { byZoom } from './zoomSize';

/** The roads closed to motorcycles as mintelonline.de collects them: a dashed line, and the road sign where one begins. */

const SIGN = 'closure-sign';
// Closed to motorcycles, as the road sign says it: a motorcycle in a red ring. Temaki's motorcycle (CC0).
const MOTORCYCLE_SIGN = sign(ring(SIGN_RED) + svgInlay(motorcycle, 6, 5.6, 1.0667, '#111'));

export const CLOSURES: Overlay = {
  id: 'closures',
  label: t('Motorcycle closures'),
  parts: (sharpUntil) => ({
    sources: {
      closures: {
        type: 'geojson',
        // Written on the server by `make closures`.
        data: '/closures.geojson',
        attribution: `${t('Motorcycle closures')}: <a href="https://www.mintelonline.de/streckensperrungen/">mintelonline.de</a>`,
      },
    },
    layers: [
      {
        id: 'closures-casing',
        type: 'line',
        source: 'closures',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': byZoom(7, 9, 16, 0.95, sharpUntil), 'line-opacity': 0.85 },
      },
      {
        id: 'closures-line',
        type: 'line',
        source: 'closures',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': SIGN_RED, 'line-width': byZoom(4, 6, 12, 0.8, sharpUntil), 'line-dasharray': [1.5, 1] },
      },
      {
        id: 'closures-point',
        type: 'symbol',
        source: 'closures',
        filter: ['==', ['geometry-type'], 'Point'],
        layout: { 'icon-image': SIGN, 'icon-size': signSize(sharpUntil), 'icon-allow-overlap': true },
      },
    ],
  }),
  sign: MOTORCYCLE_SIGN,
  images: new Map([[SIGN, MOTORCYCLE_SIGN]]),
  taps: [
    {
      layers: ['closures-line', 'closures-point'],
      info: (closure) => ({
        title: String(closure['name'] ?? ''),
        // The source's descriptions are HTML; only their text is shown.
        lines: [new DOMParser().parseFromString(String(closure['description'] ?? ''), 'text/html').body.textContent?.trim() ?? ''].filter((line) => line !== ''),
      }),
    },
  ],
};
