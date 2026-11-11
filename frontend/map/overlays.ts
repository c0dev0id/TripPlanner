import motorcycle from '@rapideditor/temaki/icons/motorcycle.svg?raw';
import type { ExpressionSpecification, LayerSpecification, RasterSourceSpecification, SourceSpecification } from 'maplibre-gl';
import { createSignal } from 'solid-js';
import { t } from '../i18n/t';
import { readPreference, writePreference } from '../ui/preferences';
import { svgContent, svgUrl, type MapImage } from './mapImages';

/**
 * What the map draws between the base map and the trip while switched on: the roadworks
 * of two German states' map services, and the roads closed to motorcycles.
 */

/** What an overlay puts into the map's style. */
interface OverlayParts {
  sources: Record<string, SourceSpecification>;
  layers: LayerSpecification[];
}

export interface Overlay {
  id: string;
  label: string;
  /**
   * Its sources and layers over a base map that is drawn sharp up to the zoom `sharpUntil`
   * and blown up beyond it, as raster tiles are; undefined for a base map sharp at every zoom.
   */
  parts: (sharpUntil: number | undefined) => OverlayParts;
  /** The pictures its layers draw, by the id they ask for them. */
  images?: Record<string, MapImage>;
}

/** The zooms sizes are worked out for; between them they are interpolated. */
const ZOOMS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

/** About how wide a country road is drawn at the zooms a base map is sharp at, in CSS pixels. */
const ROAD_PX = 12;

/**
 * How wide the roads of a base map are at a zoom beyond `sharpUntil`, where its picture
 * doubles with every zoom; 0 where it is sharp, and its roads keep to a few pixels.
 */
const blownUpRoad = (zoom: number, sharpUntil: number | undefined): number => (sharpUntil === undefined || zoom <= sharpUntil ? 0 : ROAD_PX * 2 ** (zoom - sharpUntil));

/**
 * A size by the zoom that does not fall behind the roads under it: `far` at zoom 10 and
 * below, `mid` at 14, `near` from 18 on, and at least `ofRoad` times the width of a road
 * the base map blows up.
 */
function byZoom(far: number, mid: number, near: number, ofRoad: number, sharpUntil: number | undefined): ExpressionSpecification {
  const own = (zoom: number) => (zoom <= 14 ? far + ((mid - far) * (zoom - 10)) / 4 : mid + ((near - mid) * Math.min(zoom - 14, 4)) / 4);
  return ['interpolate', ['linear'], ['zoom'], ...ZOOMS.flatMap((zoom) => [zoom, Math.max(own(zoom), ofRoad * blownUpRoad(zoom, sharpUntil))])];
}

/** The side of a map service's signs as it draws them, in CSS pixels. */
const WMS_SIGN_PX = 20;
/** The most a map service is asked to enlarge its signs. */
const WMS_MAX_SCALE = 8;

/**
 * How much larger than its own size a WMS draws its signs and lines from each zoom on, so
 * that a sign stays wider than the road it stands on: somewhat larger as the roads widen,
 * and in step with a base map that is blown up.
 */
function wmsScales(sharpUntil: number | undefined): { fromZoom: number; scale: number }[] {
  const scales = [
    { fromZoom: 0, scale: 1 },
    { fromZoom: 12, scale: 1.5 },
    { fromZoom: 14, scale: 2 },
  ];
  for (const zoom of ZOOMS) {
    const scale = Math.min(WMS_MAX_SCALE, Math.round((1.3 * blownUpRoad(zoom, sharpUntil)) / WMS_SIGN_PX));
    if (scale > scales.at(-1)!.scale) scales.push({ fromZoom: zoom, scale });
  }
  return scales;
}

/**
 * The layers of a WMS as tiles of 512 px, asked for only within `bounds` (west, south,
 * east, north): a source and a layer for each scale, shown in its zooms. The scale is
 * GeoServer's `dpi` option, 90 being its own size.
 */
function wms(id: string, url: string, layers: string, bounds: [number, number, number, number], attribution: string, sharpUntil: number | undefined): OverlayParts {
  const query = `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layers}&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=512&HEIGHT=512`;
  const scales = wmsScales(sharpUntil);
  const parts: OverlayParts = { sources: {}, layers: [] };
  for (const [i, { fromZoom, scale }] of scales.entries()) {
    const part = `${id}-${fromZoom}`;
    parts.sources[part] = { type: 'raster', tiles: [`${url}?${query}&FORMAT_OPTIONS=dpi:${90 * scale}&BBOX={bbox-epsg-3857}`], tileSize: 512, bounds, attribution } satisfies RasterSourceSpecification;
    parts.layers.push({ id: part, type: 'raster', source: part, minzoom: fromZoom, maxzoom: scales[i + 1]?.fromZoom ?? 24 });
  }
  return parts;
}

const CLOSURES_SOURCE = 'closures';
const CLOSURE_COLOR = '#d0021b';
const CLOSURE_SIGN = 'closure-sign';
/** The sign's side in CSS pixels at icon size 1, and the pixels it is drawn with for each: it is shown several times that size over a base map blown up. */
const SIGN_SIZE = 28;
const SIGN_PIXEL_RATIO = 6;

/** Closed to motorcycles, as the road sign says it: a motorcycle in a red ring. Temaki's motorcycle (CC0). */
const closureSign = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIGN_SIZE * SIGN_PIXEL_RATIO}" height="${SIGN_SIZE * SIGN_PIXEL_RATIO}" viewBox="0 0 28 28">` +
    `<circle cx="14" cy="14" r="11.5" fill="#fff" stroke="${CLOSURE_COLOR}" stroke-width="4"/>` +
    `<g transform="translate(6 5.6) scale(1.0667)" fill="#111">${svgContent(motorcycle)}</g></svg>`,
);

/** The layers a tap looks for a closure in. */
export const CLOSURE_LAYERS = [`${CLOSURES_SOURCE}-line`, `${CLOSURES_SOURCE}-point`];

export const OVERLAYS: readonly Overlay[] = [
  {
    id: 'roadworks',
    label: t('Roadworks'),
    parts: (sharpUntil) => {
      const rlp = wms(
        'roadworks-rlp',
        'https://maps.mobilitaetsatlas.de/geoserver/ows',
        // Drawn in this order: the diversions lowest, the sites' signs on top.
        'mwvlw:umleitung,mwvlw:verlauf,mwvlw:baustelle',
        [6.1, 48.3, 9.4, 51.7],
        `${t('Roadworks')}: <a href="https://www.mobilitaetsatlas.de">Mobilitätsatlas Rheinland-Pfalz</a>`,
        sharpUntil,
      );
      const bw = wms('roadworks-bw', 'https://api.mobidata-bw.de/geoserver/ows', 'MobiData-BW:roadworks', [7.4, 47.4, 10.6, 49.9], `${t('Roadworks')}: <a href="https://www.mobidata-bw.de">MobiData BW</a>`, sharpUntil);
      return { sources: { ...rlp.sources, ...bw.sources }, layers: [...rlp.layers, ...bw.layers] };
    },
  },
  {
    id: 'closures',
    label: t('Motorcycle closures'),
    parts: (sharpUntil) => ({
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
          paint: { 'line-color': '#ffffff', 'line-width': byZoom(7, 9, 16, 0.95, sharpUntil), 'line-opacity': 0.85 },
        },
        {
          id: `${CLOSURES_SOURCE}-line`,
          type: 'line',
          source: CLOSURES_SOURCE,
          filter: ['==', ['geometry-type'], 'LineString'],
          paint: { 'line-color': CLOSURE_COLOR, 'line-width': byZoom(4, 6, 12, 0.8, sharpUntil), 'line-dasharray': [1.5, 1] },
        },
        {
          id: `${CLOSURES_SOURCE}-point`,
          type: 'symbol',
          source: CLOSURES_SOURCE,
          filter: ['==', ['geometry-type'], 'Point'],
          layout: { 'icon-image': CLOSURE_SIGN, 'icon-size': byZoom(0.7, 1, 1.4, 1.3 / SIGN_SIZE, sharpUntil), 'icon-allow-overlap': true },
        },
      ],
    }),
    images: { [CLOSURE_SIGN]: { url: closureSign, size: SIGN_SIZE, pixelRatio: SIGN_PIXEL_RATIO } },
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
