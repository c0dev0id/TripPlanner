import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, For, on, Show } from 'solid-js';
import { OVERLAYS, shownOverlays } from './overlays';
import { popupOnTap } from './tapPopup';

/** Says what a feature of an overlay tapped on the map is. */
export function OverlayInfo(props: { map: MapLibreMap }) {
  const popups = OVERLAYS.flatMap((overlay) => overlay.taps).map((tap) =>
    popupOnTap(props.map, tap.layers, (properties) => {
      const info = tap.info(properties);
      return (
        <div>
          <h4>{info.title}</h4>
          <For each={info.lines}>{(line) => <p>{line}</p>}</For>
          <Show when={info.note}>{(note) => <p class="muted">{note()}</p>}</Show>
        </div>
      ) as Node;
    }),
  );
  // A popup does not outlive its overlay being switched off.
  createEffect(on(shownOverlays, () => popups.forEach((popup) => popup.remove())));
  return null;
}
