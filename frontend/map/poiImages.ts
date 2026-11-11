import cafe from '@mapbox/maki/icons/cafe.svg?raw';
import fuel from '@mapbox/maki/icons/fuel.svg?raw';
import lodging from '@mapbox/maki/icons/lodging.svg?raw';
import parking from '@mapbox/maki/icons/parking.svg?raw';
import restaurant from '@mapbox/maki/icons/restaurant.svg?raw';
import viewpoint from '@mapbox/maki/icons/viewpoint.svg?raw';
import { POI_CATEGORIES, type PoiCategory, type PoiCategoryId } from '../poi/categories';
import { svgContent, svgUrl, type MapImage } from './mapImages';

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

function badgeUrl(category: PoiCategory): string {
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE * PIXEL_RATIO}" height="${SIZE * PIXEL_RATIO}" viewBox="0 0 24 24">` +
      `<circle cx="12" cy="12" r="10.75" fill="${category.color}" stroke="#fff" stroke-width="1.5"/>` +
      `<g transform="translate(5.25 5.25) scale(0.9)" fill="#fff">${svgContent(MAKI[category.id])}</g></svg>`,
  );
}

const BADGE_URLS = new Map(POI_CATEGORIES.map((category) => [category.id, badgeUrl(category)]));

/** A category's badge as an SVG image address, for the map and for a legend. */
export const poiBadgeUrl = (category: PoiCategory): string => BADGE_URLS.get(category.id)!;

/** The map image of a category's badge. */
export const poiImageId = (categoryId: PoiCategoryId): string => `poi-${categoryId}`;

export const POI_IMAGES: ReadonlyMap<string, MapImage> = new Map(POI_CATEGORIES.map((category) => [poiImageId(category.id), { url: poiBadgeUrl(category), size: SIZE, pixelRatio: PIXEL_RATIO }]));
