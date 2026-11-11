import cone from '@mapbox/maki/icons/construction.svg?raw';
import type { ExpressionSpecification, GeoJSONSourceSpecification, LayerSpecification } from 'maplibre-gl';
import { t } from '../i18n/t';
import { dateText } from '../ui/format';
import { svgInlay, type MapImage } from './mapImages';
import type { Overlay, TapInfo } from './overlays';
import { byZoom, ring, sign, SIGN_GREY, SIGN_RED, signSize } from './overlaySigns';

/**
 * The roadworks two German states' services list, read as features (WFS) and drawn by the
 * planner: a line with a warning sign, a red ring where the road is closed, diversions in
 * blue, works yet to begin in grey.
 */

/** A service's address, and the fields its sites say what they are with. */
interface Service {
  url: string;
  attribution: string;
  start: string;
  end: string;
  street: string;
  description: string;
  /** Who reports the site. */
  reporter: string;
  /** The field and its value that say the road is closed. */
  closed: [field: string, value: string];
  /** The kind of work in words, where the service says it. */
  kind?: string;
  speedLimit?: string;
}

/** Rhineland-Palatinate's: sites as points, their stretches and their diversions as lines. */
export const RLP: Service = {
  url: 'https://maps.mobilitaetsatlas.de/geoserver/ows',
  attribution: `${t('Roadworks')}: <a href="https://www.mobilitaetsatlas.de">Mobilitätsatlas Rheinland-Pfalz</a>`,
  start: 'von',
  end: 'bis',
  street: 'strasse',
  description: 'beschreibung',
  reporter: 'quelle',
  closed: ['art_der_arbeiten', 'Vollsperrung'],
  kind: 'art_der_arbeiten',
  speedLimit: 'speedlimit',
};

/** Baden-Württemberg's: each site a line. */
export const BW: Service = {
  url: 'https://api.mobidata-bw.de/geoserver/ows',
  attribution: `${t('Roadworks')}: <a href="https://www.mobidata-bw.de">MobiData BW</a>`,
  start: 'starttime',
  end: 'endtime',
  street: 'street',
  description: 'description',
  reporter: 'reference',
  closed: ['type', 'ROAD_CLOSED'],
};

/** Rhineland-Palatinate's service also lists Baden-Württemberg's sites, which that state's own service has. */
const NOT_BW = "quelle<>'Verkehrsministerium Baden-Württemberg'";

/**
 * All features of a type of a service, those matching `filter` (CQL) where given, as
 * GeoJSON. The data has a metre's precision, which tiles of zoom 14 keep.
 */
function wfs(service: Service, type: string, filter?: string): GeoJSONSourceSpecification {
  const query = new URLSearchParams({ SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: type, OUTPUTFORMAT: 'application/json', SRSNAME: 'EPSG:4326', ...(filter && { CQL_FILTER: filter }) });
  return { type: 'geojson', data: `${service.url}?${query}`, maxzoom: 14, attribution: service.attribution };
}

const COLOR = '#e03131';
const DIVERSION_COLOR = '#1971c2';

/** A traffic cone in a warning triangle, Maki's (CC0). */
const warningSign = (color: string): MapImage =>
  sign(`<path d="M14 3.5 25.5 24h-23Z" fill="#fff" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>${svgInlay(cone, 9.1, 10.4, 0.65, '#111')}`);

/** The signs by the id the layers ask for them: for works and for a closed road, each in grey while yet to begin. */
const SIGNS = {
  'roadworks-sign': warningSign(SIGN_RED),
  'roadworks-sign-planned': warningSign(SIGN_GREY),
  'road-closed-sign': sign(ring(SIGN_RED)),
  'road-closed-sign-planned': sign(ring(SIGN_GREY)),
};

/** The hour it is: works that begin later are yet to begin. By the hour, so that the layers stay the same from one style to the next. */
const thisHour = (): string => new Date().toISOString().slice(0, 13);

function layers(sharpUntil: number): LayerSpecification[] {
  const hour = thisHour();
  const planned = (service: Service): ExpressionSpecification => ['>', ['to-string', ['get', service.start]], hour];
  const signOf = (service: Service): ExpressionSpecification => [
    'concat',
    ['case', ['==', ['get', service.closed[0]], service.closed[1]], 'road-closed-sign', 'roadworks-sign'],
    ['case', planned(service), '-planned', ''],
  ];
  const line = (id: string, color: string | ExpressionSpecification): LayerSpecification => ({
    id,
    type: 'line',
    source: id,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': color, 'line-width': byZoom(2.5, 4, 8, 0.5, sharpUntil) },
  });
  return [
    line('roadworks-rlp-diversions', DIVERSION_COLOR),
    line('roadworks-rlp-stretches', COLOR),
    line('roadworks-bw', ['case', planned(BW), SIGN_GREY, COLOR]),
    {
      id: 'roadworks-bw-signs',
      type: 'symbol',
      source: 'roadworks-bw',
      layout: { 'symbol-placement': 'line-center', 'icon-image': signOf(BW), 'icon-size': signSize(sharpUntil), 'icon-rotation-alignment': 'viewport' },
    },
    {
      id: 'roadworks-rlp-sites',
      type: 'symbol',
      source: 'roadworks-rlp-sites',
      layout: { 'icon-image': signOf(RLP), 'icon-size': signSize(sharpUntil) },
    },
  ];
}

/** What a site of the service says about itself. */
export function siteInfo(service: Service, site: Record<string, unknown>): TapInfo {
  const text = (field: string | undefined): string | undefined => {
    const value = field === undefined ? undefined : site[field];
    return typeof value === 'string' && value !== '' ? value : typeof value === 'number' ? String(value) : undefined;
  };
  /** The day of an ISO date and time. */
  const day = (field: string) => text(field)?.slice(0, 10);
  const [from, until, limit] = [day(service.start), day(service.end), text(service.speedLimit)];
  const lines = [
    text(service.kind) ?? (site[service.closed[0]] === service.closed[1] ? t('Road closed') : undefined),
    text(service.description),
    from && until && `${dateText(from)} – ${dateText(until)}`,
    limit && t('Speed limit {limit} km/h', { limit }),
  ];
  return { title: text(service.street) ?? t('Roadworks'), lines: lines.filter((line): line is string => typeof line === 'string'), note: text(service.reporter) };
}

export const ROADWORKS: Overlay = {
  id: 'roadworks',
  label: t('Roadworks'),
  parts: (sharpUntil) => ({
    sources: {
      'roadworks-rlp-diversions': wfs(RLP, 'mwvlw:umleitung'),
      'roadworks-rlp-stretches': wfs(RLP, 'mwvlw:verlauf', NOT_BW),
      'roadworks-rlp-sites': wfs(RLP, 'mwvlw:baustelle', NOT_BW),
      'roadworks-bw': wfs(BW, 'MobiData-BW:roadworks'),
    },
    layers: layers(sharpUntil),
  }),
  sign: SIGNS['roadworks-sign'],
  images: new Map(Object.entries(SIGNS)),
  // A stretch or a diversion carries nothing but its site's id: only sites say what they are.
  taps: [
    { layers: ['roadworks-rlp-sites'], info: (site) => siteInfo(RLP, site) },
    { layers: ['roadworks-bw-signs', 'roadworks-bw'], info: (site) => siteInfo(BW, site) },
  ],
};
