import { t } from '../i18n/t';
import { onePane, type PaneLevel } from '../state/panel';
import { followPointer } from './followPointer';
import { readPreference, writePreference } from './preferences';

/** A pane's width: its custom property and the preference this browser keeps it as. */
type Width = { variable: string; preference: string };

const WIDTHS: Record<PaneLevel, Width> = {
  library: { variable: '--panel-width', preference: 'panelWidth' },
  second: { variable: '--side-pane-width', preference: 'sidePaneWidth' },
  detail: { variable: '--detail-pane-width', preference: 'detailPaneWidth' },
};

/** The narrowest a pane is dragged to, and the least of the map a pane leaves; as the styles have them. */
const MIN_WIDTH = 280;
const MAP_MIN = 320;

/** Sets a width; the default for undefined. */
function applyWidth(of: Width, width: number | undefined): void {
  document.documentElement.style.setProperty(of.variable, width === undefined ? null : `${width}px`);
}

for (const of of Object.values(WIDTHS)) applyWidth(of, Number(readPreference(of.preference)) || undefined);

/**
 * The right edge of a pane: dragging it sets the pane's width, between its least and
 * what leaves the map its least, which this browser keeps as a preference; a double
 * click puts the default back. Where one pane alone is shown, every pane has the
 * library's width.
 */
export function PanelResizer(props: { of: PaneLevel }) {
  const width = () => WIDTHS[onePane() ? 'library' : props.of];
  const drag = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const of = width();
    const pane = (e.currentTarget as HTMLElement).parentElement!;
    const left = pane.getBoundingClientRect().left;
    const most = pane.offsetWidth + document.querySelector<HTMLElement>('.map-wrap')!.offsetWidth - MAP_MIN;
    const within = (x: number) => Math.round(Math.max(MIN_WIDTH, Math.min(x - left, most)));
    let to = pane.offsetWidth;
    const move = (m: PointerEvent) => {
      to = within(m.clientX);
      applyWidth(of, to);
    };
    followPointer(e, move, () => writePreference(of.preference, String(to)));
    e.preventDefault();
  };
  const reset = () => {
    writePreference(width().preference, undefined);
    applyWidth(width(), undefined);
  };
  return <div class="panel-resizer" role="separator" aria-orientation="vertical" aria-label={t('Panel width')} title={t("Drag to resize the panel; double-click to reset")} onPointerDown={drag} onDblClick={reset} />;
}
