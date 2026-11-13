import { t } from '../i18n/t';
import { followPointer } from './followPointer';
import { readPreference, writePreference } from './preferences';

/** A width an edge sets: its custom property, the preference this browser keeps it as, and the most of the window it may take. */
type Width = { variable: string; preference: string; share: number };

const LIBRARY: Width = { variable: '--panel-width', preference: 'panelWidth', share: 0.6 };
const SIDE_PANE: Width = { variable: '--side-pane-width', preference: 'sidePaneWidth', share: 0.4 };
const MIN_WIDTH = 280;

const clamped = (of: Width, width: number): number => Math.max(MIN_WIDTH, Math.min(width, window.innerWidth * of.share));

/** Sets a width within what the window allows; the default for undefined. */
function applyWidth(of: Width, width: number | undefined): void {
  document.documentElement.style.setProperty(of.variable, width === undefined ? null : `${clamped(of, width)}px`);
}

for (const of of [LIBRARY, SIDE_PANE]) applyWidth(of, Number(readPreference(of.preference)) || undefined);

/** The column an edge sets the width of: the one before the column it stands on the left of. */
const columnOf = (e: Event): Element => (e.currentTarget as HTMLElement).parentElement!.previousElementSibling!;

const widthOf = (column: Element): Width => (column.classList.contains('side-pane') ? SIDE_PANE : LIBRARY);

/**
 * The left edge of a column: dragging it sets the width of the column before it, the
 * library's panel or the pane beside it, which this browser keeps as a preference; a
 * double click puts the default back.
 */
export function PanelResizer() {
  const drag = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const column = columnOf(e);
    const of = widthOf(column);
    const left = column.getBoundingClientRect().left;
    let width = e.clientX - left;
    const move = (m: PointerEvent) => {
      width = m.clientX - left;
      applyWidth(of, width);
    };
    followPointer(e, move, () => writePreference(of.preference, String(Math.round(clamped(of, width)))));
    e.preventDefault();
  };
  const reset = (e: MouseEvent) => {
    const of = widthOf(columnOf(e));
    writePreference(of.preference, undefined);
    applyWidth(of, undefined);
  };
  return <div class="panel-resizer" role="separator" aria-orientation="vertical" aria-label={t('Width of the panel')} title={t("Drag to set the panel's width; double-click for the default")} onPointerDown={drag} onDblClick={reset} />;
}
