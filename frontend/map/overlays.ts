import type { LayerSpecification, RasterSourceSpecification, SourceSpecification } from 'maplibre-gl';
import { createSignal } from 'solid-js';
import { t } from '../i18n/t';
import { readPreference, writePreference } from '../ui/preferences';

/**
 * What the map draws between the base map and the trip while switched on: the roadworks
 * of two German states' map services, and the roads closed to motorcycles.
 */

export interface Overlay {
  id: string;
  label: string;
  sources: Record<string, SourceSpecification>;
  layers: LayerSpecification[];
}

/** The layers of a WMS as tiles of 512 px, asked for only within `bounds` (west, south, east, north). */
function wms(url: string, layers: string, bounds: [number, number, number, number], attribution: string): RasterSourceSpecification {
  const query = `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layers}&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=512&HEIGHT=512`;
  return { type: 'raster', tiles: [`${url}?${query}&BBOX={bbox-epsg-3857}`], tileSize: 512, bounds, attribution };
}

const CLOSURES_SOURCE = 'closures';
const CLOSURE_COLOR = '#c2255c';

/** The layers a tap looks for a closure in. */
export const CLOSURE_LAYERS = [`${CLOSURES_SOURCE}-line`, `${CLOSURES_SOURCE}-point`];

export const OVERLAYS: readonly Overlay[] = [
  {
    id: 'roadworks',
    label: t('Roadworks'),
    sources: {
      'roadworks-rlp': wms(
        'https://maps.mobilitaetsatlas.de/geoserver/ows',
        // Drawn in this order: the diversions lowest, the sites' signs on top.
        'mwvlw:umleitung,mwvlw:verlauf,mwvlw:baustelle',
        [6.1, 48.3, 9.4, 51.7],
        `${t('Roadworks')}: <a href="https://www.mobilitaetsatlas.de">Mobilitätsatlas Rheinland-Pfalz</a>`,
      ),
      'roadworks-bw': wms(
        'https://api.mobidata-bw.de/geoserver/ows',
        'MobiData-BW:roadworks',
        [7.4, 47.4, 10.6, 49.9],
        `${t('Roadworks')}: <a href="https://www.mobidata-bw.de">MobiData BW</a>`,
      ),
    },
    layers: [
      { id: 'roadworks-rlp', type: 'raster', source: 'roadworks-rlp' },
      { id: 'roadworks-bw', type: 'raster', source: 'roadworks-bw' },
    ],
  },
  {
    id: 'closures',
    label: t('Motorcycle closures'),
    sources: {
      [CLOSURES_SOURCE]: {
        type: 'geojson',
        // Written on the server by `make closures`.
        data: '/closures.geojson',
        attribution: `${t('Motorcycle closures')}: <a href="https://www.mintelonline.de/streckensperrungen/">mintelonline.de</a>`,
      },
    },
    layers: [
      {
        id: `${CLOSURES_SOURCE}-casing`,
        type: 'line',
        source: CLOSURES_SOURCE,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.85 },
      },
      {
        id: `${CLOSURES_SOURCE}-line`,
        type: 'line',
        source: CLOSURES_SOURCE,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': CLOSURE_COLOR, 'line-width': 4, 'line-dasharray': [1.5, 1] },
      },
      {
        id: `${CLOSURES_SOURCE}-point`,
        type: 'circle',
        source: CLOSURES_SOURCE,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': CLOSURE_COLOR, 'circle-stroke-width': 3 },
      },
    ],
  },
];

/** The ids of the overlays this browser switched on. */
const [shownIds, setShownIds] = createSignal<readonly string[]>((readPreference('overlays') ?? '').split(',').filter((id) => OVERLAYS.some((o) => o.id === id)));

export const isShown = (overlay: Overlay): boolean => shownIds().includes(overlay.id);

export const shownOverlays = (): Overlay[] => OVERLAYS.filter(isShown);

/** Switches the overlay on or off and keeps that for this browser. */
export function toggleOverlay(overlay: Overlay): void {
  const ids = isShown(overlay) ? shownIds().filter((id) => id !== overlay.id) : [...shownIds(), overlay.id];
  setShownIds(ids);
  writePreference('overlays', ids.length > 0 ? ids.join(',') : undefined);
}
