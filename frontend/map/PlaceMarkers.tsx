import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, For, onCleanup, Show } from 'solid-js';
import { t } from '../i18n/t';
import { poiDetails } from '../poi/details';
import { placesOnMap, setMapView } from '../state/places';
import { PlacesControl } from './PlacesControl';
import { POI_LAYERS, POI_SOURCE, poiFeatures } from './poiOverlay';
import { popupOnTap } from './tapPopup';

/** Keeps the places of the kinds switched on on the map, tells the map's view to what reads them, and says what one tapped is. */
export function PlaceMarkers(props: { map: MapLibreMap }) {
  const tellView = () => {
    const bounds = props.map.getBounds();
    setMapView({ bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()], zoom: props.map.getZoom() });
  };
  tellView();
  props.map.on('moveend', tellView);
  const control = new PlacesControl();
  props.map.addControl(control, 'top-right');
  onCleanup(() => {
    props.map.off('moveend', tellView);
    props.map.removeControl(control);
  });
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
    if (places.length === 0) popup.remove();
  });
  return null;
}
