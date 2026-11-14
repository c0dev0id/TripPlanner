import type { Feature, FeatureCollection, Point } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import type { OwnPlace } from '../poi/ownPlaces';

/** The source and layer of the user's own places on the map: a dot each, in the colour of its kind. */

export const OWN_PLACES_SOURCE = 'own-places';

export const OWN_PLACES_LAYERS: LayerSpecification[] = [
  {
    id: OWN_PLACES_SOURCE,
    type: 'circle',
    source: OWN_PLACES_SOURCE,
    paint: { 'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
  },
];

export function ownPlaceFeatures(places: readonly { place: OwnPlace; color: string }[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: places.map(({ place, color }): Feature<Point> => ({ type: 'Feature', properties: { id: place.id, color }, geometry: { type: 'Point', coordinates: place.lngLat } })),
  };
}
