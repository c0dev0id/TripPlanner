import { Popup, type Map as MapLibreMap, type MapMouseEvent } from 'maplibre-gl';
import { onCleanup } from 'solid-js';
import { editingRoute, editRoute, openTrip, selectDay, selectedDayId, viewRoute } from '../state/trip';
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

/** Takes up a route found on the map: shows its day and edits the route, or in a collection looks at it. */
export function takeUpRoute({ routeId, dayId }: DrawnRoute): void {
  if (selectedDayId() !== dayId) selectDay(dayId);
  if (openTrip()?.kind === 'trip') editRoute(routeId);
  else viewRoute(routeId);
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
 * While no route is being edited, the route under the pointer is drawn as wide as an
 * edited one and named beside the pointer, which shows that a click takes the route up
 * (see Interactions).
 */
export function RouteHover(props: { map: MapLibreMap }) {
  const { map } = props;
  const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'route-name' });
  let hovered: string | undefined;
  const hover = (routeId: string | undefined) => {
    if (routeId === hovered) return;
    if (hovered && map.getSource(ROUTES_SOURCE)) map.removeFeatureState({ source: ROUTES_SOURCE, id: hovered }, 'hover');
    if (routeId) map.setFeatureState({ source: ROUTES_SOURCE, id: routeId }, { hover: true });
    map.getCanvas().style.cursor = routeId ? 'pointer' : '';
    hovered = routeId;
  };
  const onMove = (e: MapMouseEvent) => {
    const at = editingRoute() ? undefined : routeAt(map, e.point, HOVER_REACH);
    hover(at?.routeId);
    if (at) popup.setLngLat(e.lngLat).setText(nameOf(at)).addTo(map);
    else popup.remove();
  };
  const onLeave = () => {
    hover(undefined);
    popup.remove();
  };
  map.on('mousemove', onMove);
  map.on('mouseout', onLeave);
  onCleanup(() => {
    map.off('mousemove', onMove);
    map.off('mouseout', onLeave);
    onLeave();
  });
  return null;
}
