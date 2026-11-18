import type { Feature, FeatureCollection, Point } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import { t } from '../i18n/t';
import type { BadgeId, Place, PoiCategoryId } from '../poi/categories';
import { poiImageId } from './poiImages';

/** The source and layer of the places on the map, each the badge of its kind. */

export const POI_SOURCE = 'pois';
export const PLACES_ATTRIBUTION = t('Places: © OpenStreetMap contributors');

export const POI_LAYERS: LayerSpecification[] = [
  {
    id: POI_SOURCE,
    type: 'symbol',
    source: POI_SOURCE,
    layout: { 'icon-image': ['get', 'image'], 'icon-allow-overlap': true },
  },
];

/** The places as features, each drawn with the badge `badgeOf` names for its kind. */
export function poiFeatures(pois: readonly Place[], badgeOf: (kind: PoiCategoryId) => BadgeId): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: pois.map((poi): Feature<Point> => ({ type: 'Feature', properties: { id: poi.id, image: poiImageId(badgeOf(poi.category.id)) }, geometry: { type: 'Point', coordinates: poi.lngLat } })),
  };
}
