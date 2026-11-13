import type { LngLat } from '../model/trip';

/**
 * A spot opened in another map: Google's through its documented Maps URLs
 * (developers.google.com/maps/documentation/urls), OpenStreetMap's through its marker
 * parameters (wiki.openstreetmap.org/wiki/Browsing).
 */

const latLng = ([lng, lat]: LngLat, separator: string): string => `${lat.toFixed(6)}${separator}${lng.toFixed(6)}`;

/** Google Maps with a pin at the spot. */
export const googleMapsUrl = (spot: LngLat): string => `https://www.google.com/maps/search/?api=1&query=${latLng(spot, ',')}`;

/** Google Street View at the panorama nearest the spot. */
export const streetViewUrl = (spot: LngLat): string => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latLng(spot, ',')}`;

/** OpenStreetMap with a marker at the spot, close enough to see the roads around it. */
export const openStreetMapUrl = (spot: LngLat): string => `https://www.openstreetmap.org/?mlat=${spot[1].toFixed(6)}&mlon=${spot[0].toFixed(6)}#map=17/${latLng(spot, '/')}`;
