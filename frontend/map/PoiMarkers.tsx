import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, For, Show } from 'solid-js';
import { t } from '../i18n/t';
import { poiDetails } from '../poi/details';
import type { Poi } from '../poi/overpass';
import { foundPois } from '../state/poi';
import { keptPoisOnMap } from '../state/routePois';
import { POI_LAYERS, POI_SOURCE, poiFeatures } from './poiOverlay';
import { popupOnTap } from './tapPopup';

/** The places on the map: those kept for the routes and switched on, and what the running or last search found; each once. */
const placesOnMap = (): Poi[] => [...new Map([...keptPoisOnMap(), ...foundPois()].map((poi) => [poi.id, poi])).values()];

/** Keeps the places of POI searches on the map, and says what one tapped is. */
export function PoiMarkers(props: { map: MapLibreMap }) {
  const popup = popupOnTap(
    props.map,
    POI_LAYERS.map((layer) => layer.id),
    ({ id }) => {
      const poi = placesOnMap().find((p) => p.id === id);
      if (!poi) return undefined;
      const category = poi.category.label;
      const details = poiDetails(poi.tags);
      return (
        <div>
          <h4>{details.name ?? category}</h4>
          <Show when={details.name}>
            <p class="muted">{category}</p>
          </Show>
          <For each={details.lines}>{(line) => <p>{line}</p>}</For>
          <p>
            <Show when={details.homepage}>
              {(homepage) => (
                <>
                  <a href={homepage()} target="_blank" rel="noopener noreferrer">
                    {t('Homepage')}
                  </a>
                  {' · '}
                </>
              )}
            </Show>
            <a href={`https://www.openstreetmap.org/${poi.id}`} target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>
          </p>
        </div>
      ) as Node;
    },
  );
  createEffect(() => {
    const places = placesOnMap();
    props.map.getSource<GeoJSONSource>(POI_SOURCE)?.setData(poiFeatures(places));
    // A search that still runs adds places; the popup goes when they do.
    if (places.length === 0) popup.remove();
  });
  return null;
}
