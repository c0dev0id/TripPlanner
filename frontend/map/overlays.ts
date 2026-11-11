import cone from '@mapbox/maki/icons/construction.svg?raw';
import motorcycle from '@rapideditor/temaki/icons/motorcycle.svg?raw';
import type { ExpressionSpecification, GeoJSONSourceSpecification, LayerSpecification, SourceSpecification } from 'maplibre-gl';
import { createSignal } from 'solid-js';
import { t } from '../i18n/t';
import { readPreference, writePreference } from '../ui/preferences';
import { svgContent, svgUrl, type MapImage } from './mapImages';

/**
 * What the map draws between the base map and the trip while switched on: the roadworks
 * two German states' services list, and the roads closed to motorcycles.
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

/** A sign's side in CSS pixels at icon size 1, and the pixels it is drawn with for each: it is shown several times that size over a base map blown up. */
const SIGN_SIZE = 28;
const SIGN_PIXEL_RATIO = 6;

/** A sign of 28 × 28 as a map image. */
const sign = (drawing: string): MapImage => ({
  url: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIGN_SIZE * SIGN_PIXEL_RATIO}" height="${SIGN_SIZE * SIGN_PIXEL_RATIO}" viewBox="0 0 28 28">${drawing}</svg>`),
  size: SIGN_SIZE,
  pixelRatio: SIGN_PIXEL_RATIO,
});

/** A sign that grows as `byZoom` has it, 1.3 times as wide as a road blown up. */
const signSize = (sharpUntil: number | undefined): ExpressionSpecification => byZoom(0.7, 1, 1.4, 1.3 / SIGN_SIZE, sharpUntil);

const SIGN_RED = '#d0021b';
const RING = `<circle cx="14" cy="14" r="11.5" fill="#fff" stroke="${SIGN_RED}" stroke-width="4"/>`;

const CLOSURES_SOURCE = 'closures';
const CLOSURE_SIGN = 'closure-sign';

const ROADWORKS_SIGN = 'roadworks-sign';
const ROAD_CLOSED_SIGN = 'road-closed-sign';
const ROADWORKS_COLOR = '#e03131';
const DIVERSION_COLOR = '#1971c2';

/** The roadworks of Rhineland-Palatinate's service: sites as points, their stretches and their diversions as lines. */
const RLP = 'https://maps.mobilitaetsatlas.de/geoserver/ows';
const RLP_ATTRIBUTION = `${t('Roadworks')}: <a href="https://www.mobilitaetsatlas.de">Mobilitätsatlas Rheinland-Pfalz</a>`;
/** Baden-Württemberg's: each site a line. */
const BW = 'https://api.mobidata-bw.de/geoserver/ows';
const BW_ATTRIBUTION = `${t('Roadworks')}: <a href="https://www.mobidata-bw.de">MobiData BW</a>`;

/** All features of a type of a WFS, as GeoJSON. */
const wfs = (url: string, type: string, attribution: string): GeoJSONSourceSpecification => ({
  type: 'geojson',
  data: `${url}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${type}&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326`,
  attribution,
});

/** The Rhineland-Palatinate service also carries Baden-Württemberg's sites, which that state's own service has. */
const NOT_BW: ExpressionSpecification = ['!=', ['get', 'quelle'], 'Verkehrsministerium Baden-Württemberg'];

/** The layers of roadworks: a line, and a sign that says whether the road is closed, both fainter for works yet to begin. */
function roadworksLayers(sharpUntil: number | undefined): LayerSpecification[] {
  const now = new Date().toISOString();
  const faintBefore = (start: string): ExpressionSpecification => ['case', ['>', ['to-string', ['get', start]], now], 0.45, 1];
  const signOf = (closed: ExpressionSpecification): ExpressionSpecification => ['case', closed, ROAD_CLOSED_SIGN, ROADWORKS_SIGN];
  const line = (id: string, color: string, filter?: ExpressionSpecification, start?: string): LayerSpecification => ({
    id,
    type: 'line',
    source: id,
    ...(filter && { filter }),
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': color, 'line-width': byZoom(2.5, 4, 8, 0.5, sharpUntil), ...(start && { 'line-opacity': faintBefore(start) }) },
  });
  return [
    line('roadworks-rlp-diversions', DIVERSION_COLOR),
    line('roadworks-rlp-stretches', ROADWORKS_COLOR, NOT_BW),
    line('roadworks-bw', ROADWORKS_COLOR, undefined, 'starttime'),
    {
      id: 'roadworks-bw-signs',
      type: 'symbol',
      source: 'roadworks-bw',
      layout: { 'symbol-placement': 'line-center', 'icon-image': signOf(['==', ['get', 'type'], 'ROAD_CLOSED']), 'icon-size': signSize(sharpUntil), 'icon-rotation-alignment': 'viewport' },
      paint: { 'icon-opacity': faintBefore('starttime') },
    },
    {
      id: 'roadworks-rlp-sites',
      type: 'symbol',
      source: 'roadworks-rlp-sites',
      filter: NOT_BW,
      layout: { 'icon-image': signOf(['==', ['get', 'art_der_arbeiten'], 'Vollsperrung']), 'icon-size': signSize(sharpUntil) },
      paint: { 'icon-opacity': faintBefore('von') },
    },
  ];
}

/** The layers a tap looks for roadworks in: those whose features say what they are. */
export const ROADWORKS_LAYERS = ['roadworks-rlp-sites', 'roadworks-bw-signs', 'roadworks-bw'];

/** The layers a tap looks for a closure in. */
export const CLOSURE_LAYERS = [`${CLOSURES_SOURCE}-line`, `${CLOSURES_SOURCE}-point`];

export const OVERLAYS: readonly Overlay[] = [
  {
    id: 'roadworks',
    label: t('Roadworks'),
    parts: (sharpUntil) => ({
      sources: {
        'roadworks-rlp-diversions': wfs(RLP, 'mwvlw:umleitung', RLP_ATTRIBUTION),
        'roadworks-rlp-stretches': wfs(RLP, 'mwvlw:verlauf', RLP_ATTRIBUTION),
        'roadworks-rlp-sites': wfs(RLP, 'mwvlw:baustelle', RLP_ATTRIBUTION),
        'roadworks-bw': wfs(BW, 'MobiData-BW:roadworks', BW_ATTRIBUTION),
      },
      layers: roadworksLayers(sharpUntil),
    }),
    images: {
      // A traffic cone in a warning triangle, Maki's (CC0); a red ring, the sign for a road closed to all vehicles.
      [ROADWORKS_SIGN]: sign(`<path d="M14 3.5 25.5 24h-23Z" fill="#fff" stroke="${SIGN_RED}" stroke-width="3" stroke-linejoin="round"/><g transform="translate(9.1 10.4) scale(0.65)" fill="#111">${svgContent(cone)}</g>`),
      [ROAD_CLOSED_SIGN]: sign(RING),
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
          paint: { 'line-color': SIGN_RED, 'line-width': byZoom(4, 6, 12, 0.8, sharpUntil), 'line-dasharray': [1.5, 1] },
        },
        {
          id: `${CLOSURES_SOURCE}-point`,
          type: 'symbol',
          source: CLOSURES_SOURCE,
          filter: ['==', ['geometry-type'], 'Point'],
          layout: { 'icon-image': CLOSURE_SIGN, 'icon-size': signSize(sharpUntil), 'icon-allow-overlap': true },
        },
      ],
    }),
    // Closed to motorcycles, as the road sign says it: a motorcycle in a red ring. Temaki's motorcycle (CC0).
    images: { [CLOSURE_SIGN]: sign(`${RING}<g transform="translate(6 5.6) scale(1.0667)" fill="#111">${svgContent(motorcycle)}</g>`) },
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
