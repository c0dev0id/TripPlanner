import { Map as MapLibreMap, NavigationControl, ScaleControl } from 'maplibre-gl';
import { onCleanup, onMount } from 'solid-js';

/** OpenFreeMap serves this vector style without a key. */
const BASE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export function MapView() {
  let container!: HTMLDivElement;
  onMount(() => {
    const map = new MapLibreMap({
      container,
      style: BASE_STYLE,
      center: [10.5, 47.5],
      zoom: 5,
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new ScaleControl(), 'bottom-left');
    onCleanup(() => map.remove());
  });
  return <div class="map" ref={container} />;
}
