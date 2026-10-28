import type { StyleSpecification } from 'maplibre-gl';
import { createSignal } from 'solid-js';
import { readPreference, writePreference } from '../ui/preferences';

/** The base maps to choose from: OpenFreeMap's vector styles, and raster tiles for the topographic and the classic looks. */

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
  { id: 'positron', label: 'Positron, light', style: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'dark', label: 'Dark', style: 'https://tiles.openfreemap.org/styles/dark' },
  { id: 'opentopomap', label: 'OpenTopoMap', style: raster('https://tile.opentopomap.org/{z}/{x}/{y}.png', `Map data: ${OSM_ATTRIBUTION}, SRTM · Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`, 17) },
  { id: 'osm', label: 'OpenStreetMap', style: raster('https://tile.openstreetmap.org/{z}/{x}/{y}.png', OSM_ATTRIBUTION, 19) },
  { id: 'cyclosm', label: 'CyclOSM', style: raster('https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', `Map style: <a href="https://www.cyclosm.org">CyclOSM</a>, hosted by OpenStreetMap France · Map data: ${OSM_ATTRIBUTION}`, 20) },
];

const stored = readPreference('baseMap');
/** The base map this browser chose last, or the first. */
const [chosenBaseMap, setChosenBaseMap] = createSignal(BASE_MAPS.find((b) => b.id === stored) ?? BASE_MAPS[0]!);
export { chosenBaseMap };

export function chooseBaseMap(baseMap: BaseMap): void {
  setChosenBaseMap(baseMap);
  writePreference('baseMap', baseMap.id);
}
