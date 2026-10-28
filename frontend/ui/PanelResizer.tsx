import { onCleanup } from 'solid-js';
import { readPreference, writePreference } from './preferences';

const PREFERENCE = 'panelWidth';
const MIN_WIDTH = 280;

/** The panel's width as this browser keeps it, within what the window allows. */
function keptWidth(): number | undefined {
  const kept = Number(readPreference(PREFERENCE));
  return kept >= MIN_WIDTH ? kept : undefined;
}

function applyWidth(width: number | undefined): void {
  document.documentElement.style.setProperty('--panel-width', width === undefined ? null : `${clamped(width)}px`);
}

const clamped = (width: number): number => Math.max(MIN_WIDTH, Math.min(width, window.innerWidth * 0.6));

/**
 * The edge between the panel and the map: dragging it sets the panel's width, which this
 * browser keeps as a preference; a double click puts the default back.
 */
export function PanelResizer() {
  applyWidth(keptWidth());
  const drag = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    let width = clamped(e.clientX);
    const move = (m: PointerEvent) => {
      width = clamped(m.clientX);
      applyWidth(width);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      writePreference(PREFERENCE, String(Math.round(width)));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    e.preventDefault();
  };
  const reset = () => {
    writePreference(PREFERENCE, undefined);
    applyWidth(undefined);
  };
  onCleanup(() => applyWidth(undefined));
  return <div class="panel-resizer" role="separator" aria-orientation="vertical" aria-label="Width of the panel" title="Drag to set the panel's width; double-click for the default" onPointerDown={drag} onDblClick={reset} />;
}
