import { GeolocateControl, Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl, type GeoJSONSourceSpecification, type MapOptions, type StyleSpecification } from 'maplibre-gl';
import { createEffect, on } from 'solid-js';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { ROUTING_ATTRIBUTION } from '../routing/valhalla';
import { BaseMapControl } from './BaseMapControl';
import { OverlayControl } from './OverlayControl';
import { chosenBaseMap, sharpUntil } from './baseMaps';
import { provideImages } from './mapImages';
import { OVERLAYS, shownOverlays } from './overlays';
import { POI_IMAGES } from './poiImages';
import { PLACES_ATTRIBUTION, POI_LAYERS, POI_SOURCE } from './poiOverlay';
import { OPENED_RECORDING_SOURCE, RECORDING_LAYERS, RECORDING_POINT_LAYERS, RECORDING_POINT_SOURCE, RECORDINGS_SOURCE } from './recordingOverlay';
import { ROUTE_LAYERS, ROUTES_SOURCE } from './routeOverlay';

// The worker is built as a file of its own; MapLibre's own lookup does not find it in a bundle.
setWorkerUrl(workerUrl);

/**
 * The base style with the trip's lines on top, the recordings under the routes, the places
 * a POI search found and the point picked on a recording over them, and under all of these the overlays switched on: their
 * sources and layers are appended to every style the map loads, and the trip's sources
 * keep their data across a change of base map, since MapLibre hands the transform the
 * style it is leaving.
 */
function withOverlays(previous: StyleSpecification | undefined, next: StyleSpecification): StyleSpecification {
  const empty = (): GeoJSONSourceSpecification => ({ type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const sources: StyleSpecification['sources'] = { ...next.sources, [ROUTES_SOURCE]: previous?.sources[ROUTES_SOURCE] ?? { ...empty(), attribution: ROUTING_ATTRIBUTION } };
  for (const id of [RECORDINGS_SOURCE, OPENED_RECORDING_SOURCE, RECORDING_POINT_SOURCE]) sources[id] = previous?.sources[id] ?? empty();
  sources[POI_SOURCE] = previous?.sources[POI_SOURCE] ?? { ...empty(), attribution: PLACES_ATTRIBUTION };
  const overlays = shownOverlays().map((overlay) => overlay.parts(sharpUntil(next)));
  // An overlay's data read once stays: a source written anew would be fetched again.
  for (const overlay of overlays) for (const [id, source] of Object.entries(overlay.sources)) sources[id] = previous?.sources[id] ?? source;
  return { ...next, sources, layers: [...next.layers, ...overlays.flatMap((o) => o.layers), ...RECORDING_LAYERS, ...ROUTE_LAYERS, ...POI_LAYERS, ...RECORDING_POINT_LAYERS] };
}

/**
 * A map over Europe on the base map this browser chose, with the navigation, locate-me,
 * base map, overlay and scale controls and the route overlay; `ready` gets the map once it has
 * loaded. Called while a component is set up, whose lifetime the map's following of the
 * choices takes.
 */
export function newBaseMap(container: HTMLElement, options: Partial<MapOptions>, ready: (map: MapLibreMap) => void): MapLibreMap {
  const map = new MapLibreMap({ container, style: chosenBaseMap().style, transformStyle: withOverlays, center: [10.5, 47.5], zoom: 5, attributionControl: { compact: true }, ...options });
  map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, fitBoundsOptions: { maxZoom: 13 } }), 'top-right');
  map.addControl(new BaseMapControl(), 'top-right');
  map.addControl(new OverlayControl(), 'top-right');
  map.addControl(new ScaleControl(), 'bottom-left');
  provideImages(map, new Map([...POI_IMAGES, ...OVERLAYS.flatMap((overlay) => [...overlay.images])]));
  // The style follows the base map chosen and the overlays switched on.
  createEffect(on([chosenBaseMap, shownOverlays], () => map.setStyle(chosenBaseMap().style), { defer: true }));
  map.once('load', () => ready(map));
  return map;
}
