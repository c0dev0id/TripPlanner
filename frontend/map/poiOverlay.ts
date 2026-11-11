import type { Feature, FeatureCollection, Point } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import type { Poi } from '../poi/overpass';
import { poiImageId } from './poiImages';

/** The source and layer of the places a POI search found, each the badge of its category. */

export const POI_SOURCE = 'pois';

export const POI_LAYERS: LayerSpecification[] = [
  {
    id: POI_SOURCE,
    type: 'symbol',
    source: POI_SOURCE,
    layout: { 'icon-image': ['get', 'image'], 'icon-allow-overlap': true },
  },
];

export function poiFeatures(pois: readonly Poi[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: pois.map((poi): Feature<Point> => ({ type: 'Feature', properties: { id: poi.id, image: poiImageId(poi.category.id) }, geometry: { type: 'Point', coordinates: poi.lngLat } })),
  };
}
