import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import type { XY } from '../geo/nearest';
import { nearestPlaceOn, partInBox } from '../geo/reach';
import { t } from '../i18n/t';
import type { LngLat } from '../model/trip';
import { distanceText } from '../ui/format';
import { drawnLines } from './drawnLines';
import { MarkerHandle, toLngLat } from './markers';
import { REACH_SOURCE, reachFeatures } from './reachOverlay';

/** Below this length on the screen, in pixels, the line does not bear its label. */
const SHORT_PX = 90;
/** How far from the mark, in pixels, the label of such a line stands. */
const BESIDE_PX = 36;

/**
 * How far it is, as the crow flies, to the nearest place on the routes and tracks the
 * map draws: a dashed line to that place, labelled with the distance, from a mark that
 * starts where the device is and is dragged to measure from elsewhere. Where the device
 * does not say where it is, the mark starts in the middle of the map.
 */
export function Reach(props: { map: MapLibreMap }) {
  const [from, setFrom] = createSignal<LngLat>();
  // The lines are prepared once for a degree of latitude around the mark, not anew for every place it is dragged over.
  const latitude = createMemo(() => from() && Math.round(from()![1]));
  const nearestOn = createMemo(() => {
    const at = latitude();
    return at === undefined ? undefined : nearestPlaceOn(drawnLines(), at);
  });
  const nearest = createMemo(
    () => {
      const position = from();
      return position && nearestOn()?.(position);
    },
    undefined,
    { equals: (a, b) => a?.metres === b?.metres && a?.at[0] === b?.at[0] && a?.at[1] === b?.at[1] },
  );

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => setFrom([coords.longitude, coords.latitude]),
    () => setFrom(toLngLat(props.map.getCenter())),
    { enableHighAccuracy: true, timeout: 10_000 },
  );

  const dot = document.createElement('span');
  dot.title = t('Drag to measure from another place');
  const mark = new MarkerHandle(props.map, dot, 'reach-mark');
  mark.setDraggable(true);
  mark.marker.on('drag', () => setFrom(toLngLat(mark.marker.getLngLat())));
  createEffect(() => mark.setPosition(from()));

  const text = document.createElement('span');
  const label = new MarkerHandle(props.map, text, 'reach-label');
  label.setInteractive(false);
  /**
   * Puts the label on the middle of the line's part that is in view, so that it is read
   * wherever the line crosses the map; a line too short to bear it has it beside the
   * mark, on the side away from the line.
   */
  const placeLabel = () => {
    const [position, place] = [from(), nearest()];
    if (!position || !place) return label.setPosition(undefined);
    const [a, b] = [props.map.project(position), props.map.project(place.at)];
    const { clientWidth, clientHeight } = props.map.getContainer();
    const part = partInBox([a.x, a.y], [b.x, b.y], clientWidth, clientHeight);
    if (!part) return label.setPosition(undefined);
    const length = Math.hypot(a.x - b.x, a.y - b.y);
    // Away from the line; over the mark where the line has no length and so no direction.
    const away: XY = length === 0 ? [0, -1] : [(a.x - b.x) / length, (a.y - b.y) / length];
    const at: XY = length < SHORT_PX ? [a.x + away[0] * BESIDE_PX, a.y + away[1] * BESIDE_PX] : [(part[0][0] + part[1][0]) / 2, (part[0][1] + part[1][1]) / 2];
    label.setPosition(toLngLat(props.map.unproject([at[0], at[1]])));
  };
  createEffect(placeLabel);
  props.map.on('move', placeLabel);
  createEffect(() => (text.textContent = distanceText(nearest()?.metres ?? 0)));

  // Not among the lines the map draws: the line would be the nearest to itself.
  const draw = (position: LngLat | undefined, to: LngLat | undefined) => props.map.getSource<GeoJSONSource>(REACH_SOURCE)?.setData(reachFeatures(position, to));
  createEffect(() => draw(from(), nearest()?.at));

  onCleanup(() => {
    props.map.off('move', placeLabel);
    mark.remove();
    label.remove();
    draw(undefined, undefined);
  });
  return null;
}
