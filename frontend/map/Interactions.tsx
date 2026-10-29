import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { createEffect, onCleanup } from 'solid-js';
import { currentTool, setTool, spotItems, tapAction, tool, type Tool } from '../state/drawing';
import { isTextField } from '../ui/form';
import { menu, setMenu } from '../ui/menu';
import { addFreeStop, appendPoint, editingRoute, editRoute, insertPoint, insertStop, redo, undo } from '../state/trip';
import { fromMarker, toLngLat } from './markers';
import { hitRouteLine } from './routeTools';
import { TapFilter, tapReach, type PointerSample } from './tapFilter';

/**
 * Taps on the map and keys while a route is selected: the tool's work on that route, undo
 * and redo, the hand while the space bar is held, and the menu of a spot on the map
 * (right-click or long press).
 */
export function Interactions(props: { map: MapLibreMap }) {
  const map = props.map;

  // What the next tap does, for the cursor over the map and for the markers (styles.css).
  createEffect(() => {
    const container = map.getContainer();
    const action = tapAction();
    if (action) container.dataset.tool = action;
    else delete container.dataset.tool;
  });

  // MapLibre turns a touch held for 500 ms into a contextmenu event. The browser may still
  // send a click when that finger lifts; it must neither close the menu nor add a point.
  // A press that closes an open menu only closes it: its click adds nothing.
  let pointerType = 'mouse';
  let swallowClick = false;
  /** Where the right mouse button went down; a press that moved from there turned the map. */
  let rightDown: { x: number; y: number } | undefined;
  // Clicks that come with dragging the map are no taps (a mouse button that bounces, a
  // browser's click after a touch pan): every tap waits a moment first.
  const taps = new TapFilter();
  const sample = (e: MouseEvent): PointerSample => ({ x: e.clientX, y: e.clientY, t: e.timeStamp, touch: pointerType !== 'mouse' });
  const onPointerDown = (e: PointerEvent) => {
    pointerType = e.pointerType;
    if (e.button === 2) rightDown = { x: e.clientX, y: e.clientY };
    swallowClick = menu() !== undefined && !(e.target instanceof Element && e.target.closest('.context-menu'));
    if (e.isPrimary) taps.down(sample(e));
  };
  const onPointerMove = (e: PointerEvent) => {
    if (e.isPrimary) taps.move(sample(e));
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.isPrimary) taps.up(sample(e));
  };

  const onContextMenu = (e: MapMouseEvent) => {
    const touch = pointerType !== 'mouse';
    if (touch) swallowClick = true;
    // Stops and route points open their own menus.
    const items = fromMarker(e.originalEvent) ? undefined : spotItems(toLngLat(e.lngLat));
    if (!items) return;
    // Windows sends the contextmenu event when the button comes up, also after turning the map.
    const { clientX, clientY } = e.originalEvent;
    if (!touch && rightDown && Math.hypot(clientX - rightDown.x, clientY - rightDown.y) > 5) return;
    setMenu({ x: clientX, y: clientY, touch, items });
  };
  const onClick = (e: MapMouseEvent) => {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    taps.click(sample(e.originalEvent), () => onTap(e));
  };
  /** A click that proved to be a tap: it does what the next tap does. */
  const onTap = (e: MapMouseEvent) => {
    const action = tapAction();
    const route = editingRoute();
    // A delete tap acts on markers only.
    if ((action !== 'point' && action !== 'stop') || !route || fromMarker(e.originalEvent)) return;
    setMenu(undefined);
    const hit = hitRouteLine(map, route, [e.point.x, e.point.y], tapReach(pointerType !== 'mouse'));
    if (action === 'point') {
      if (hit) insertPoint(route.id, hit.legIndex + 1, hit.lngLat);
      else appendPoint(route.id, toLngLat(e.lngLat));
    } else if (action === 'stop') {
      if (hit) insertStop(route.id, hit.legIndex + 1, hit.lngLat);
      else addFreeStop(toLngLat(e.lngLat));
    }
  };
  // A tap made before a key comes first, so that Esc or Undo act on it.
  const onKeyDownFirst = () => taps.flush();
  /** The tool the held space bar put aside for the hand. */
  let toolBeforeSpace: Tool | undefined;
  const onKeyDown = (e: KeyboardEvent) => {
    // Text fields keep their own undo and Escape handling, and an open modal dialog has
    // the keyboard to itself.
    if (e.defaultPrevented || isTextField(e.target) || document.querySelector('dialog:modal') || !editingRoute()) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (key === 'z' || key === 'y')) {
      e.preventDefault();
      // An open menu may name a point the step takes away.
      setMenu(undefined);
      if (key === 'y' || e.shiftKey) redo();
      else undo();
      return;
    }
    if (e.key === ' ') {
      // The hand while the space bar is held: the map moves without a tap that adds.
      e.preventDefault();
      if (!e.repeat && currentTool() !== 'hand') {
        toolBeforeSpace = tool();
        setTool('hand');
      }
      return;
    }
    if (e.key !== 'Escape') return;
    // Esc goes back to the hand, then ends editing; an open menu takes it first.
    if (currentTool() !== 'hand') setTool('hand');
    else editRoute(undefined);
  };
  const onSpaceUp = (e: KeyboardEvent) => {
    if (e.key === ' ') handBack();
  };
  /** The tool put aside for the hand comes back: on the space bar's release, or when the window loses the keys. */
  const handBack = () => {
    if (toolBeforeSpace === undefined) return;
    if (editingRoute()) setTool(toolBeforeSpace);
    toolBeforeSpace = undefined;
  };

  // On the window, so it runs before the menu closes itself on the same press.
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  map.on('contextmenu', onContextMenu);
  map.on('click', onClick);
  window.addEventListener('keydown', onKeyDownFirst, true);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onSpaceUp);
  window.addEventListener('blur', handBack);
  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDownFirst, true);
    document.removeEventListener('keyup', onSpaceUp);
    window.removeEventListener('blur', handBack);
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
    map.off('contextmenu', onContextMenu);
    map.off('click', onClick);
    document.removeEventListener('keydown', onKeyDown);
  });
  return null;
}
