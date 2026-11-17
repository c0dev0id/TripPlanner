import type { FeatureCollection, Geometry } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { createSignal } from 'solid-js';
import type { LngLat } from '../model/trip';

/** The lines the map draws, by the source they are drawn from. */
const [drawn, setDrawn] = createSignal<ReadonlyMap<string, readonly (readonly LngLat[])[]>>(new Map());

/** Draws features from a source of the map, and keeps their lines for what measures across all that is drawn. */
export function drawFeatures(map: MapLibreMap, source: string, data: FeatureCollection<Geometry>): void {
  map.getSource<GeoJSONSource>(source)?.setData(data);
  const lines = data.features.flatMap((feature) => (feature.geometry.type === 'LineString' ? [feature.geometry.coordinates as LngLat[]] : []));
  setDrawn((before) => new Map(before).set(source, lines));
}

/** Every line the map draws now: the routes and tracks of the open trip and of one looked at, the recordings, and what is held beside them. */
export const drawnLines = (): readonly (readonly LngLat[])[] => [...drawn().values()].flat();
