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

/** Whether a kind of place is one of the store's, by its id; any other is a section of one of the user's own lists. */
export const isStoreKind = (id: string): id is PoiCategoryId => POI_CATEGORIES.some((category) => category.id === id);

export const POI_CATEGORIES: readonly PoiCategory[] = list.kinds.map((kind) => ({ id: kind.id as PoiCategoryId, label: LABELS[kind.id as PoiCategoryId], color: kind.color }));

export type BadgeId = PoiCategoryId | 'historic' | 'meetup' | 'bunker' | 'trail' | 'friend' | 'goodRoad' | 'badRoad' | 'roadblock';

/** What the places of a kind can be drawn with: an icon on a disc of a colour. */
export interface Badge {
  id: BadgeId;
  label: string;
  color: string;
}

/** The badges no kind of the store has. */
const OWN_BADGES: readonly Badge[] = [
  { id: 'historic', label: t('Historic sites'), color: '#9c6f19' },
  { id: 'meetup', label: t('Biker meetups'), color: '#212529' },
  { id: 'bunker', label: t('Bunkers'), color: '#5c6b2f' },
  { id: 'trail', label: t('Trailheads'), color: '#66a80f' },
  { id: 'friend', label: t('Friends'), color: '#d6336c' },
  { id: 'goodRoad', label: t('Good roads'), color: '#1c7ed6' },
  { id: 'badRoad', label: t('Bad roads'), color: '#e8590c' },
  { id: 'roadblock', label: t('Roadblocks'), color: '#c92a2a' },
];

/** Every badge: those of the store's kinds, then the others. */
export const BADGES: readonly Badge[] = [...POI_CATEGORIES, ...OWN_BADGES];

export const isBadge = (id: string): id is BadgeId => BADGES.some((badge) => badge.id === id);

/** A place of one of the kinds: the OpenStreetMap object ("node/123"), where it is, and the tags its details are made of. */
export interface Place {
  id: string;
  category: PoiCategory;
  lngLat: LngLat;
  tags: Readonly<Record<string, string>>;
}
