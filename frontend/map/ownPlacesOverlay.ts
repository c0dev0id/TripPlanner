import type { Feature, FeatureCollection, Point } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import type { BadgeId } from '../poi/categories';
import type { OwnPlace } from '../poi/ownPlaces';
import { PLACE_SCALE, poiImageId } from './poiImages';

/** The source and layers of the user's own places on the map: a dot each in the colour of its kind, or the badge picked for the kind. */

export const OWN_PLACES_SOURCE = 'own-places';

export const OWN_PLACES_LAYERS: LayerSpecification[] = [
  {
    id: OWN_PLACES_SOURCE,
    type: 'circle',
    source: OWN_PLACES_SOURCE,
    filter: ['!', ['has', 'image']],
    paint: { 'circle-radius': 6 * PLACE_SCALE, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 * PLACE_SCALE },
  },
  {
    id: `${OWN_PLACES_SOURCE}-badges`,
    type: 'symbol',
    source: OWN_PLACES_SOURCE,
    filter: ['has', 'image'],
    layout: { 'icon-image': ['get', 'image'], 'icon-allow-overlap': true },
  },
];

/** The places as features, each with its kind's colour and, where `badgeOf` names one for its kind, the badge it is drawn with. */
export function ownPlaceFeatures(places: readonly { place: OwnPlace; color: string }[], badgeOf: (kind: string) => BadgeId | undefined): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: places.map(({ place, color }): Feature<Point> => {
      const badge = badgeOf(place.dayId);
      return { type: 'Feature', properties: { id: place.id, color, ...(badge && { image: poiImageId(badge) }) }, geometry: { type: 'Point', coordinates: place.lngLat } };
    }),
  };
}
