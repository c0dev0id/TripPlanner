import cafe from '@mapbox/maki/icons/cafe.svg?raw';
import caution from '@mapbox/maki/icons/caution.svg?raw';
import fuel from '@mapbox/maki/icons/fuel.svg?raw';
import home from '@mapbox/maki/icons/home.svg?raw';
import lodging from '@mapbox/maki/icons/lodging.svg?raw';
import mountain from '@mapbox/maki/icons/mountain.svg?raw';
import parking from '@mapbox/maki/icons/parking.svg?raw';
import restaurant from '@mapbox/maki/icons/restaurant.svg?raw';
import roadblock from '@mapbox/maki/icons/roadblock.svg?raw';
import viewpoint from '@mapbox/maki/icons/viewpoint.svg?raw';
import bunker from '@rapideditor/temaki/icons/bunker.svg?raw';
import chicane from '@rapideditor/temaki/icons/chicane_arrow.svg?raw';
import motorcycle from '@rapideditor/temaki/icons/motorcycle.svg?raw';
import ruins from '@rapideditor/temaki/icons/ruins.svg?raw';
import { BADGES, type Badge, type BadgeId } from '../poi/categories';
import { svgImage, svgInlay, type MapImage } from './mapImages';

/**
 * The picture of each badge: an icon of Maki, the set made for maps and named after
 * OpenStreetMap's features, or of Temaki, the set that adds to it (both CC0), in white on
 * a disc of the badge's colour.
 */

/** The icon of each badge, as an SVG document of 15 × 15. */
const ICONS: Record<BadgeId, string> = {
  fuel,
  hotel: lodging,
  restaurant,
  cafe,
  viewpoint,
  parking,
  historic: ruins,
  meetup: motorcycle,
  bunker,
  trail: mountain,
  friend: home,
  goodRoad: chicane,
  badRoad: caution,
  roadblock,
};

/** How much larger places are drawn on a screen that is touched, where a CSS pixel can be smaller to the eye than at a desk and a place is tapped with a finger. */
export const PLACE_SCALE = matchMedia('(pointer: coarse)').matches ? 4 / 3 : 1;

/** Diameter of a badge in CSS pixels. */
const SIZE = 24 * PLACE_SCALE;
/** The badges are drawn at the screen's pixel ratio, at least twice their size, for sharp edges on dense screens. */
const PIXEL_RATIO = Math.max(2, Math.ceil(devicePixelRatio));

const picture = (badge: Badge): MapImage =>
  svgImage(SIZE, PIXEL_RATIO, `<g transform="scale(${PLACE_SCALE})"><circle cx="12" cy="12" r="10.75" fill="${badge.color}" stroke="#fff" stroke-width="1.5"/>${svgInlay(ICONS[badge.id], 5.25, 5.25, 0.9, '#fff')}</g>`);

const PICTURES = new Map(BADGES.map((badge) => [badge.id, picture(badge)]));

/** A badge as an SVG image address, for a legend. */
export const poiBadgeUrl = (badge: BadgeId): string => PICTURES.get(badge)!.url;

/** The map image of a badge. */
export const poiImageId = (badge: BadgeId): string => `poi-${badge}`;

export const POI_IMAGES: ReadonlyMap<string, MapImage> = new Map([...PICTURES].map(([id, image]) => [poiImageId(id), image]));
