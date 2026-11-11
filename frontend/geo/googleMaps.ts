import type { LngLat } from '../model/trip';

/** A spot opened in Google Maps through its documented Maps URLs (developers.google.com/maps/documentation/urls). */

const latLng = ([lng, lat]: LngLat): string => `${lat.toFixed(6)},${lng.toFixed(6)}`;

/** Google Maps with a pin at the spot. */
export const googleMapsUrl = (spot: LngLat): string => `https://www.google.com/maps/search/?api=1&query=${latLng(spot)}`;

/** Google Street View at the panorama nearest the spot. */
export const streetViewUrl = (spot: LngLat): string => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latLng(spot)}`;
