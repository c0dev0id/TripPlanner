import { followPointer } from './followPointer';
import { readPreference, writePreference } from './preferences';

const PREFERENCE = 'panelWidth';
const MIN_WIDTH = 280;

/** Sets the panel's width within what the window allows; the default for undefined. */
function applyWidth(width: number | undefined): void {
  document.documentElement.style.setProperty('--panel-width', width === undefined ? null : `${clamped(width)}px`);
}

const clamped = (width: number): number => Math.max(MIN_WIDTH, Math.min(width, window.innerWidth * 0.6));

/**
 * The edge between the panel and the map: dragging it sets the panel's width, which this
 * browser keeps as a preference; a double click puts the default back.
 */
export function PanelResizer() {
  applyWidth(Number(readPreference(PREFERENCE)) || undefined);
  const drag = (e: PointerEvent) => {
    if (e.button !== 0) return;
    let width = e.clientX;
    const move = (m: PointerEvent) => {
      width = m.clientX;
      applyWidth(width);
    };
    followPointer(e, move, () => writePreference(PREFERENCE, String(Math.round(clamped(width)))));
    e.preventDefault();
  };
  const reset = () => {
    writePreference(PREFERENCE, undefined);
    applyWidth(undefined);
  };
  return <div class="panel-resizer" role="separator" aria-orientation="vertical" aria-label="Width of the panel" title="Drag to set the panel's width; double-click for the default" onPointerDown={drag} onDblClick={reset} />;
}
