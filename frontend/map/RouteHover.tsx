import { Popup, type LngLat, type Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, on, onCleanup } from 'solid-js';
import { editingRoute, editingRouteId, openTrip, selectedDayId } from '../state/trip';
import { dayTitleOf, routeLabel } from '../trip/labels';
import { ROUTE_LINE_LAYER, ROUTES_SOURCE } from './routeOverlay';

/** A route drawn on the map, by its id and its day's. */
type DrawnRoute = { routeId: string; dayId: string };

/** How near its line the pointer names a route, in CSS pixels. */
const HOVER_REACH = 4;

/** The route whose line lies within `reach` CSS pixels of a point of the map. */
export function routeAt(map: MapLibreMap, { x, y }: { x: number; y: number }, reach: number): DrawnRoute | undefined {
  if (!map.getLayer(ROUTE_LINE_LAYER)) return undefined;
  const feature = map.queryRenderedFeatures([[x - reach, y - reach], [x + reach, y + reach]], { layers: [ROUTE_LINE_LAYER] })[0];
  return feature && { routeId: feature.properties.route as string, dayId: feature.properties.day as string };
}

/** What a route is called under the pointer: its label, after its day's while the whole trip is shown. */
function nameOf({ routeId, dayId }: DrawnRoute): string {
  const trip = openTrip();
  const day = trip?.days.find((d) => d.id === dayId);
  const route = day?.routes.find((r) => r.id === routeId);
  if (!trip || !day || !route) return '';
  return selectedDayId() === dayId ? routeLabel(route, day) : `${dayTitleOf(trip, day)} · ${routeLabel(route, day)}`;
}

/**
 * While no route is being edited, the route under a mouse's pointer is drawn as wide as an
 * edited one and named beside the pointer, which shows that a click takes the route up
 * (see Interactions). A finger has no pointer that rests: a tap takes the route up at
 * once, and nothing is named.
 */
export function RouteHover(props: { map: MapLibreMap }) {
  const { map } = props;
  const surface = map.getCanvasContainer();
  const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'route-name' });
  let hovered: string | undefined;
  /** Marks the route the pointer came onto and names it at `lngLat`, and lets go of the one it left. */
  const hover = (at: DrawnRoute | undefined, lngLat?: LngLat) => {
    if (at?.routeId === hovered) return;
    if (hovered && map.getSource(ROUTES_SOURCE)) map.removeFeatureState({ source: ROUTES_SOURCE, id: hovered }, 'hover');
    hovered = at?.routeId;
    map.getCanvas().style.cursor = at ? 'pointer' : '';
    if (!at || !lngLat) return void popup.remove();
    map.setFeatureState({ source: ROUTES_SOURCE, id: at.routeId }, { hover: true });
    popup.setLngLat(lngLat).setText(nameOf(at)).addTo(map);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const box = surface.getBoundingClientRect();
    const point = { x: e.clientX - box.left, y: e.clientY - box.top };
    const lngLat = map.unproject([point.x, point.y]);
    hover(editingRoute() ? undefined : routeAt(map, point, HOVER_REACH), lngLat);
    // The name goes along with the pointer.
    if (hovered) popup.setLngLat(lngLat);
  };
  const onLeave = () => hover(undefined);
  // The route taken up by the click is edited, and no longer one to point at.
  createEffect(on(editingRouteId, (id) => id && onLeave()));
  surface.addEventListener('pointermove', onMove);
  surface.addEventListener('pointerleave', onLeave);
  onCleanup(() => {
    surface.removeEventListener('pointermove', onMove);
    surface.removeEventListener('pointerleave', onLeave);
    onLeave();
  });
  return null;
}
