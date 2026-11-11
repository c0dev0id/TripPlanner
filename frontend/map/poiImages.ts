import cafe from '@mapbox/maki/icons/cafe.svg?raw';
import fuel from '@mapbox/maki/icons/fuel.svg?raw';
import lodging from '@mapbox/maki/icons/lodging.svg?raw';
import parking from '@mapbox/maki/icons/parking.svg?raw';
import restaurant from '@mapbox/maki/icons/restaurant.svg?raw';
import viewpoint from '@mapbox/maki/icons/viewpoint.svg?raw';
import { POI_CATEGORIES, type PoiCategory, type PoiCategoryId } from '../poi/categories';
import { svgImage, svgInlay, type MapImage } from './mapImages';

/**
 * The picture of each POI category: Maki's icon for it, the set made for maps and named
 * after OpenStreetMap's features (CC0), in white on a disc of the category's colour.
 */

/** Maki's icon of each category by its id, as an SVG document of 15 × 15. */
const MAKI: Record<PoiCategoryId, string> = { fuel, hotel: lodging, restaurant, cafe, viewpoint, parking };

/** Diameter of a badge in CSS pixels. */
const SIZE = 24;
/** The badges are drawn at twice their size, for sharp edges on dense screens. */
const PIXEL_RATIO = 2;

const badge = (category: PoiCategory): MapImage =>
  svgImage(SIZE, PIXEL_RATIO, `<circle cx="12" cy="12" r="10.75" fill="${category.color}" stroke="#fff" stroke-width="1.5"/>${svgInlay(MAKI[category.id], 5.25, 5.25, 0.9, '#fff')}`);

const BADGES = new Map(POI_CATEGORIES.map((category) => [category.id, badge(category)]));

/** A category's badge as an SVG image address, for a legend. */
export const poiBadgeUrl = (category: PoiCategory): string => BADGES.get(category.id)!.url;

/** The map image of a category's badge. */
export const poiImageId = (categoryId: PoiCategoryId): string => `poi-${categoryId}`;

export const POI_IMAGES: ReadonlyMap<string, MapImage> = new Map([...BADGES].map(([id, image]) => [poiImageId(id), image]));
