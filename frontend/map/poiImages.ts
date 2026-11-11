import cafe from '@mapbox/maki/icons/cafe.svg?raw';
import fuel from '@mapbox/maki/icons/fuel.svg?raw';
import lodging from '@mapbox/maki/icons/lodging.svg?raw';
import parking from '@mapbox/maki/icons/parking.svg?raw';
import restaurant from '@mapbox/maki/icons/restaurant.svg?raw';
import viewpoint from '@mapbox/maki/icons/viewpoint.svg?raw';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { POI_CATEGORIES, type PoiCategory, type PoiCategoryId } from '../poi/categories';

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
  const glyph = /<svg[^>]*>(.*)<\/svg>/s.exec(MAKI[category.id])![1]!;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE * PIXEL_RATIO}" height="${SIZE * PIXEL_RATIO}" viewBox="0 0 24 24">` +
    `<circle cx="12" cy="12" r="10.75" fill="${category.color}" stroke="#fff" stroke-width="1.5"/>` +
    `<g transform="translate(5.25 5.25) scale(0.9)" fill="#fff">${glyph}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const BADGE_URLS = new Map(POI_CATEGORIES.map((category) => [category.id, badgeUrl(category)]));

/** A category's badge as an SVG image address, for the map and for a legend. */
export const poiBadgeUrl = (category: PoiCategory): string => BADGE_URLS.get(category.id)!;

/** The map image of a category's badge. */
export const poiImageId = (categoryId: PoiCategoryId): string => `poi-${categoryId}`;

/**
 * Gives the map each category's badge, and again when a style asks for one, which every
 * new base map does.
 */
export async function providePoiImages(map: MapLibreMap): Promise<void> {
  const images = new Map(
    await Promise.all(
      POI_CATEGORIES.map(async (category) => {
        const image = new Image(SIZE * PIXEL_RATIO, SIZE * PIXEL_RATIO);
        image.src = poiBadgeUrl(category);
        await image.decode();
        return [poiImageId(category.id), image] as const;
      }),
    ),
  );
  const add = (id: string) => {
    const image = images.get(id);
    if (image && !map.hasImage(id)) map.addImage(id, image, { pixelRatio: PIXEL_RATIO });
  };
  map.on('styleimagemissing', ({ id }) => add(id));
  for (const id of images.keys()) add(id);
}
