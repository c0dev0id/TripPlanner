import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, For, Show } from 'solid-js';
import { t } from '../i18n/t';
import { POI_CATEGORIES } from '../poi/categories';
import { poiDetails } from '../poi/details';
import { foundPois } from '../state/poi';
import { providePoiImages } from './poiImages';
import { POI_LAYERS, POI_SOURCE, poiFeatures } from './poiOverlay';
import { popupOnTap } from './tapPopup';

/** Keeps the places a POI search found on the map, and says what one tapped is. */
export function PoiMarkers(props: { map: MapLibreMap }) {
  void providePoiImages(props.map);
  const popup = popupOnTap(
    props.map,
    'map-info',
    POI_LAYERS.map((layer) => layer.id),
    ({ id }) => {
      const poi = foundPois().find((p) => p.id === id);
      if (!poi) return undefined;
      const category = POI_CATEGORIES.find((c) => c.id === poi.categoryId)!.label;
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
    props.map.getSource<GeoJSONSource>(POI_SOURCE)?.setData(poiFeatures(foundPois()));
    popup.remove();
  });
  return null;
}
