import { Map as MapLibreMap, Marker, type LngLat as MapLibreLngLat } from 'maplibre-gl';
import type { LngLat } from '../model/trip';
import { setMenu, type MenuItem } from '../state/drawing';
import { onLongPress } from './longPress';
import { markerElement } from './markerContent';

/** A position as the map gives it, wrapped into the world, as the model's pair. */
export function toLngLat(position: MapLibreLngLat): LngLat {
  const { lng, lat } = position.wrap();
  return [lng, lat];
}

/** True if a DOM event originated from a marker (the map's click fires after the marker's). */
export function fromMarker(event: Event | undefined): boolean {
  return event?.target instanceof Element && event.target.closest('.maplibregl-marker') !== null;
}

/**
 * A draggable marker whose root element is owned by MapLibre (it sets transform, opacity
 * and pointer-events); the given content is placed inside it, centred on the position or
 * standing on it with its bottom edge.
 */
export class MarkerHandle {
  readonly marker: Marker;
  readonly root: HTMLDivElement;
  private added = false;

  constructor(
    private readonly map: MapLibreMap,
    content: Node,
    className: string,
    anchor: 'center' | 'bottom' = 'center',
  ) {
    this.root = markerElement(className, content);
    this.marker = new Marker({ element: this.root, draggable: true, anchor });
    // MapLibre starts a marker drag with any button. A right-click opens a menu under the
    // pointer that receives the release, which MapLibre never sees: the marker would then
    // follow the mouse. Only the primary button may drag.
    this.root.addEventListener('mousedown', (e) => {
      if (e.button !== 0) e.stopPropagation();
    });
  }

  /** Shows the marker at a position, or hides it for undefined. */
  setPosition(position: LngLat | undefined): void {
    if (!position) {
      this.remove();
      return;
    }
    this.marker.setLngLat(position);
    if (!this.added) {
      this.marker.addTo(this.map);
      this.added = true;
    }
  }

  /** Whether the marker can be dragged and takes clicks; otherwise clicks go through to the map. */
  setInteractive(interactive: boolean): void {
    this.marker.setDraggable(interactive);
    // Inline, since MapLibre sets pointer-events on a marker after dragging it.
    this.root.style.pointerEvents = interactive ? 'auto' : 'none';
  }

  remove(): void {
    this.marker.remove();
    this.added = false;
  }
}

/**
 * Opens the context menu with `items` from a draggable marker, which swallows the map's
 * own contextmenu event and long press: right-click for mice, a long press for touch and
 * pens. No items, no menu. Dragging the marker closes an open menu. Returns a function
 * that removes the listeners.
 */
export function onMarkerMenu(handle: MarkerHandle, items: () => MenuItem[] | undefined): () => void {
  const root = handle.root;
  const open = (x: number, y: number, touch: boolean) => {
    const list = items();
    if (list) setMenu({ x, y, touch, items: list });
  };
  let pointerType = 'mouse';
  const onPointerDown = (e: PointerEvent) => {
    pointerType = e.pointerType;
  };
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Android also fires contextmenu on a long press; that one comes from onLongPress.
    if (pointerType === 'mouse') open(e.clientX, e.clientY, false);
  };
  const onDragStart = () => setMenu(undefined);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('contextmenu', onContextMenu);
  handle.marker.on('dragstart', onDragStart);
  const stopLongPress = onLongPress(root, (x, y) => open(x, y, true));
  return () => {
    stopLongPress();
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('contextmenu', onContextMenu);
    handle.marker.off('dragstart', onDragStart);
  };
}
