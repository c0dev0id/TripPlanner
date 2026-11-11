import { t } from '../i18n/t';
import type { LngLat } from '../model/trip';
import list from './places.json';

/**
 * The kinds of places the map shows, each by the values of one OpenStreetMap tag: the list
 * in places.json, which the server fetches by, with a name for each.
 */

export type PoiCategoryId = 'fuel' | 'hotel' | 'restaurant' | 'cafe' | 'viewpoint' | 'parking';

export interface PoiCategory {
  id: PoiCategoryId;
  label: string;
  color: string;
}

const LABELS: Record<PoiCategoryId, string> = {
  fuel: t('Fuel stations'),
  hotel: t('Hotels'),
  restaurant: t('Restaurants'),
  cafe: t('Cafes'),
  viewpoint: t('Viewpoints'),
  parking: t('Parking'),
};

export const POI_CATEGORIES: readonly PoiCategory[] = list.kinds.map((kind) => ({ id: kind.id as PoiCategoryId, label: LABELS[kind.id as PoiCategoryId], color: kind.color }));

/** A place of one of the kinds: the OpenStreetMap object ("node/123"), where it is, and the tags its details are made of. */
export interface Place {
  id: string;
  category: PoiCategory;
  lngLat: LngLat;
  tags: Readonly<Record<string, string>>;
}
