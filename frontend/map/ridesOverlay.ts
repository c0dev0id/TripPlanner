import { t } from '../i18n/t';
import { distanceText, momentText } from '../ui/format';
import type { Overlay } from './overlays';
import { sign } from './overlaySigns';
import { byZoom } from './zoomSize';

/**
 * Every ride the user has recorded, all at once: a translucent line each, so that a road
 * ridden often is drawn darker and one never ridden not at all. A tap says which ride it is.
 */

// Apart from the roads of the base maps, which are yellow and orange, and from the palette of the routes.
const RIDE_COLOR = '#5f3dc4';

export const RIDES: Overlay = {
  id: 'rides',
  label: t('My rides'),
  parts: (sharpUntil, look) => ({
    // The lines the planner keeps beside the recordings' files, read anew each time the overlay is switched on.
    sources: { rides: { type: 'geojson', data: '/api/rides' } },
    layers: [
      {
        id: 'rides-line',
        type: 'line',
        source: 'rides',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': RIDE_COLOR, 'line-width': byZoom(2.5, 3.5, 6, 0.5, sharpUntil), 'line-opacity': look.ridesOpacity },
      },
    ],
  }),
  sign: sign(`<path d="M4 21c3-11 7-12 10-7s6 4 10-7" fill="none" stroke="${RIDE_COLOR}" stroke-width="4" stroke-linecap="round"/>`),
  images: new Map(),
  taps: [
    {
      layers: ['rides-line'],
      info: (ride) => ({
        title: String(ride['name'] ?? ''),
        lines: [ride['startedAt'] ? momentText(String(ride['startedAt'])) : t('no times'), distanceText(Number(ride['distanceM']))],
        note: String(ride['trip'] ?? ''),
      }),
    },
  ],
};
