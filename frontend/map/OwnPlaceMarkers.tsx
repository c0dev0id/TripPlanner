import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, Show } from 'solid-js';
import { t } from '../i18n/t';
import { webAddress } from '../poi/details';
import { addOwnPlaceAsStop, ownPlaceById, ownPlacesOnMap } from '../state/ownPlaces';
import { openTrip, selectedDay } from '../state/trip';
import { OWN_PLACES_LAYERS, OWN_PLACES_SOURCE, ownPlaceFeatures } from './ownPlacesOverlay';
import { popupOnTap } from './tapPopup';

/**
 * Keeps the user's own places of the kinds switched on on the map, and says what one tapped
 * is: its name, list and kind, what it says of itself, its website, and with a day of a
 * trip shown, the button that adds a copy of it to the day as a stop.
 */
export function OwnPlaceMarkers(props: { map: MapLibreMap }) {
  const popup = popupOnTap(
    props.map,
    OWN_PLACES_LAYERS.map((layer) => layer.id),
    ({ id }) => {
      const place = ownPlaceById(id as string);
      if (!place) return undefined;
      const add = () => {
        addOwnPlaceAsStop(place);
        popup.remove();
      };
      return (
        <div>
          <h4>{place.name}</h4>
          <p class="muted">
            {place.list} · {place.kind}
          </p>
          <Show when={place.address}>
            <p>{place.address}</p>
          </Show>
          <Show when={place.contact}>
            <p>{place.contact}</p>
          </Show>
          <Show when={place.notes}>
            <p class="notes">{place.notes}</p>
          </Show>
          <Show when={webAddress(place.website)}>
            {(address) => (
              <p>
                <a href={address()} target="_blank" rel="noopener noreferrer">
                  {t('Website')}
                </a>
              </p>
            )}
          </Show>
          <Show when={openTrip()?.kind === 'trip' && selectedDay()}>
            <p>
              <button type="button" onClick={add}>
                {t('Add as stop')}
              </button>
            </p>
          </Show>
        </div>
      ) as Node;
    },
  );
  createEffect(() => {
    const places = ownPlacesOnMap();
    props.map.getSource<GeoJSONSource>(OWN_PLACES_SOURCE)?.setData(ownPlaceFeatures(places));
    if (places.length === 0) popup.remove();
  });
  return null;
}
