import type { Feature, FeatureCollection, Point } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import { POI_CATEGORIES } from '../poi/categories';
import type { Poi } from '../poi/overpass';

/** The source and layer of the places a POI search found, each a dot in its category's colour. */

export const POI_SOURCE = 'pois';

export const POI_LAYERS: LayerSpecification[] = [
  {
    id: POI_SOURCE,
    type: 'circle',
    source: POI_SOURCE,
    paint: {
      'circle-radius': 6,
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  },
];

export function poiFeatures(pois: readonly Poi[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: pois.map((poi): Feature<Point> => {
      const color = POI_CATEGORIES.find((c) => c.id === poi.categoryId)!.color;
      return { type: 'Feature', properties: { id: poi.id, color }, geometry: { type: 'Point', coordinates: poi.lngLat } };
    }),
  };
}
