import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { createEffect, onCleanup } from 'solid-js';
import { menu, setMenu, setTool, tapAction, tool } from '../state/drawing';
import { addStop, insertPoint, insertStop, redo, selectedDay, undo } from '../state/trip';
import { fromMarker, toLngLat } from './markers';
import { hitRouteLine } from './routeTools';
import { TapFilter, tapReach, type PointerSample } from './tapFilter';

/**
 * Taps on the map and keys while a day is edited: the tool's work on the selected day,
 * undo and redo, and the menu of a spot on the map (right-click or long press).
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
    if (fromMarker(e.originalEvent) || !selectedDay()) return;
    // Windows sends the contextmenu event when the button comes up, also after turning the map.
    const { clientX, clientY } = e.originalEvent;
    if (!touch && rightDown && Math.hypot(clientX - rightDown.x, clientY - rightDown.y) > 5) return;
    const spot = toLngLat(e.lngLat);
    setMenu({ x: e.point.x, y: e.point.y, touch, items: [{ label: 'Add stop here', run: () => addStop(spot) }] });
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
    const day = selectedDay();
    if (!action || !day || fromMarker(e.originalEvent)) return;
    setMenu(undefined);
    const hit = hitRouteLine(map, day, [e.point.x, e.point.y], tapReach(pointerType !== 'mouse'));
    if (action === 'stop') {
      if (hit) insertStop(hit.routeIndex, hit.legIndex, hit.lngLat);
      else addStop(toLngLat(e.lngLat));
    } else if (action === 'point' && hit) {
      insertPoint(day.routes[hit.routeIndex]!.id, hit.legIndex + 1, hit.lngLat);
    }
  };
  const onMoveStart = () => setMenu(undefined);
  // A tap made before a key comes first, so that Esc or Undo act on it.
  const onKeyDownFirst = () => taps.flush();
  const onKeyDown = (e: KeyboardEvent) => {
    // Text fields keep their own undo and Escape handling, and an open modal dialog has
    // the keyboard to itself.
    if (e.defaultPrevented || isTextField(e.target) || document.querySelector('dialog:modal') || !selectedDay()) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (key === 'z' || key === 'y')) {
      e.preventDefault();
      // An open menu may name a point the step takes away.
      setMenu(undefined);
      if (key === 'y' || e.shiftKey) redo();
      else undo();
      return;
    }
    if (e.key !== 'Escape') return;
    if (menu()) setMenu(undefined);
    else if (tool() !== 'stop') setTool('stop');
  };

  // On the window, so it runs before the menu closes itself on the same press.
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  map.on('contextmenu', onContextMenu);
  map.on('click', onClick);
  map.on('movestart', onMoveStart);
  window.addEventListener('keydown', onKeyDownFirst, true);
  document.addEventListener('keydown', onKeyDown);
  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDownFirst, true);
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
    map.off('contextmenu', onContextMenu);
    map.off('click', onClick);
    map.off('movestart', onMoveStart);
    document.removeEventListener('keydown', onKeyDown);
  });
  return null;
}

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'file', 'button', 'submit', 'reset', 'color']);

function isTextField(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);
}
