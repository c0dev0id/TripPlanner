import { t } from '../i18n/t';

/** The kinds of places the POI search finds, each by the values of one OpenStreetMap tag. */

export interface PoiCategory {
  id: string;
  label: string;
  /** The tag key and the values of it that make a place one of this kind. */
  key: string;
  values: readonly string[];
  /** Values of `access` that leave a place out. */
  noAccess?: readonly string[];
  /** How far from the route a place of this kind is still worth the detour, in metres. */
  alongM: number;
  color: string;
}

export const POI_CATEGORIES: readonly PoiCategory[] = [
  { id: 'fuel', label: t('Fuel stations'), key: 'amenity', values: ['fuel'], alongM: 200, color: '#2b8a3e' },
  { id: 'hotel', label: t('Hotels'), key: 'tourism', values: ['hotel', 'guest_house', 'motel'], alongM: 10000, color: '#5f3dc4' },
  { id: 'restaurant', label: t('Restaurants'), key: 'amenity', values: ['restaurant'], alongM: 2000, color: '#e67700' },
  { id: 'cafe', label: t('Cafes'), key: 'amenity', values: ['cafe'], alongM: 2000, color: '#7b4a2d' },
  { id: 'viewpoint', label: t('Viewpoints'), key: 'tourism', values: ['viewpoint'], alongM: 2000, color: '#0b7285' },
  { id: 'parking', label: t('Parking'), key: 'amenity', values: ['parking', 'motorcycle_parking'], noAccess: ['private', 'no'], alongM: 200, color: '#495057' },
];

/** The category a place with these tags belongs to. */
export function categoryOf(tags: Readonly<Record<string, string>>): PoiCategory | undefined {
  return POI_CATEGORIES.find((c) => c.values.includes(tags[c.key] ?? ''));
}
