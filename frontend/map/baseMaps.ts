import { t } from '../i18n/t';
import type { StyleSpecification } from 'maplibre-gl';
import { createSignal } from 'solid-js';
import { readPreference, writePreference } from '../ui/preferences';

/** The base maps to choose from: OpenFreeMap's vector styles, and raster tiles for the topographic and the classic looks and for satellite imagery. */

export interface BaseMap {
  id: string;
  label: string;
  /** A style's address, or a style around one raster source. */
  style: string | StyleSpecification;
}

const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function raster(tiles: string, attribution: string, maxzoom: number): StyleSpecification {
  return {
    version: 8,
    sources: { base: { type: 'raster', tiles: [tiles], tileSize: 256, maxzoom, attribution } },
    layers: [{ id: 'base', type: 'raster', source: 'base' }],
  };
}

export const BASE_MAPS: readonly BaseMap[] = [
  { id: 'liberty', label: 'Liberty', style: 'https://tiles.openfreemap.org/styles/liberty' },
  { id: 'bright', label: 'Bright', style: 'https://tiles.openfreemap.org/styles/bright' },
  { id: 'positron', label: t('Positron, light'), style: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'dark', label: t('Dark'), style: 'https://tiles.openfreemap.org/styles/dark' },
  { id: 'opentopomap', label: 'OpenTopoMap', style: raster('https://tile.opentopomap.org/{z}/{x}/{y}.png', `Map data: ${OSM_ATTRIBUTION}, SRTM · Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`, 17) },
  { id: 'osm', label: 'OpenStreetMap', style: raster('https://tile.openstreetmap.org/{z}/{x}/{y}.png', OSM_ATTRIBUTION, 19) },
  { id: 'cyclosm', label: 'CyclOSM', style: raster('https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', `Map style: <a href="https://www.cyclosm.org">CyclOSM</a>, hosted by OpenStreetMap France · Map data: ${OSM_ATTRIBUTION}`, 20) },
  { id: 'topplusopen', label: 'TopPlusOpen', style: raster('https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png', '© <a href="https://www.bkg.bund.de">BKG</a> (<a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a>) · <a href="https://sgx.geodatenzentrum.de/web_public/Datenquellen_TopPlus_Open.pdf">Data sources</a>', 18) },
  { id: 'satellite', label: t('Satellite'), style: raster('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'Tiles © <a href="https://www.esri.com">Esri</a> · Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community', 19) },
];

/**
 * The zoom up to which a base style of raster tiles alone is drawn sharp, beyond which its
 * picture is blown up; Infinity for a style with vector tiles, sharp at every zoom, also
 * where it has a raster source for its relief. A tile of 256 px at its zoom covers what
 * the map shows a zoom lower.
 */
export function sharpUntil(style: Pick<StyleSpecification, 'sources'>): number {
  const sources = Object.values(style.sources);
  if (sources.some((source) => source.type === 'vector')) return Infinity;
  const sharp = sources.flatMap((source) => (source.type === 'raster' && source.maxzoom !== undefined ? [source.maxzoom - Math.log2(512 / (source.tileSize ?? 512))] : []));
  return sharp.length > 0 ? Math.max(...sharp) : Infinity;
}

const stored = readPreference('baseMap');
/** The base map this browser chose last, or the first. */
const [chosenBaseMap, setChosenBaseMap] = createSignal(BASE_MAPS.find((b) => b.id === stored) ?? BASE_MAPS[0]!);
export { chosenBaseMap };

export function chooseBaseMap(baseMap: BaseMap): void {
  setChosenBaseMap(baseMap);
  writePreference('baseMap', baseMap.id);
}
