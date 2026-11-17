import { Show, type JSX } from 'solid-js';
import { t } from '../i18n/t';
import { entered, fold, folded, onePane, setSheet, sheet, sheetMode, shownLevel, type PaneLevel } from '../state/panel';
import { spaceMenu } from './cardMenu';
import { followPointer } from './followPointer';
import { ArrowDownIcon, ArrowUpIcon, BackIcon, ChevronIcon, ChevronLeftIcon, CloseIcon } from './icons';
import type { MenuItem } from './menu';
import { PanelResizer } from './PanelResizer';

/**
 * The top edge of the pane where it is a sheet under the map: dragged, it sets how much
 * of the screen the sheet takes, down to its bar; a tap folds it to the bar or brings it
 * back.
 */
function SheetHandle(props: { level: PaneLevel }) {
  let dragged = false;
  const drag = (e: PointerEvent) => {
    const pane = (e.currentTarget as HTMLElement).parentElement!;
    const from = { y: e.clientY, height: pane.offsetHeight };
    dragged = false;
    followPointer(
      e,
      (m) => {
        if (Math.abs(m.clientY - from.y) > 4) dragged = true;
        if (!dragged) return;
        pane.classList.add('dragging');
        pane.style.height = `${from.height + from.y - m.clientY}px`;
      },
      () => {
        if (!dragged) return;
        const share = pane.offsetHeight / window.innerHeight;
        fold(props.level, share < 0.2);
        if (share >= 0.2) setSheet(share < 0.65 ? 'half' : 'full');
        pane.classList.remove('dragging');
        pane.style.height = '';
      },
    );
  };
  const tap = () => {
    if (!dragged) fold(props.level, !folded(props.level));
  };
  const label = () => t('Drag to resize the list; tap to collapse or expand it');
  return <button class="sheet-handle" title={label()} aria-label={label()} aria-expanded={!folded(props.level)} onPointerDown={drag} onClick={tap} />;
}

/**
 * A pane beside the map, which on a phone held upright is a sheet under it: its head,
 * with what it is and the pads that fold it to a strip and close it, over what it holds.
 * `strip` is what the strip holds under its pads. Where one pane alone is shown, the pad
 * that closes leads back to the pane before. `onUse` hears of a click or a menu asked
 * for in what the pane holds, before the row clicked does. `menu` is what a right-click
 * on the free space among its rows opens.
 */
export function Pane(props: {
  level: PaneLevel;
  label: string;
  heading: JSX.Element;
  onClose?: () => void;
  strip?: JSX.Element;
  onUse?: () => void;
  /** The menu of the free space among what the pane holds. */
  menu?: () => MenuItem[];
  children: JSX.Element;
}) {
  const isFolded = () => folded(props.level);
  const foldLabel = () => t(isFolded() ? 'Unfold {what}' : 'Fold {what}', { what: props.label });
  const closeLabel = () => (onePane() ? t('Back') : t('Close {what}', { what: props.label }));
  const used = () => props.onUse?.();
  return (
    <aside
      class="panel pane"
      classList={{
        [`pane-${props.level}`]: true,
        'side-pane': props.level !== 'library',
        'sheet-full': sheet() === 'full',
        folded: isFolded(),
        shown: shownLevel() === props.level,
        [entered() ?? '']: entered() !== undefined,
      }}
      aria-label={props.label}
    >
      <SheetHandle level={props.level} />
      <header class="pane-head">
        <div class="pane-heading">{props.heading}</div>
        <div class="pane-pads">
          <button class="icon pane-pad" title={foldLabel()} aria-label={foldLabel()} aria-expanded={!isFolded()} onClick={() => fold(props.level, !isFolded())}>
            <Show when={sheetMode()} fallback={isFolded() ? <ChevronIcon /> : <ChevronLeftIcon />}>
              {isFolded() ? <ArrowUpIcon /> : <ArrowDownIcon />}
            </Show>
          </button>
          <Show when={props.onClose}>
            {(close) => (
              <button class="icon pane-pad" title={closeLabel()} aria-label={closeLabel()} onClick={() => close()()}>
                {onePane() ? <BackIcon /> : <CloseIcon />}
              </button>
            )}
          </Show>
        </div>
      </header>
      <div class="pane-strip">{props.strip}</div>
      <div
        class="pane-body"
        ref={(el) => {
          // Heard before the row clicked hears of it, and before a card's menu opens.
          el.addEventListener('click', used, true);
          el.addEventListener('contextmenu', used, true);
          if (props.menu) spaceMenu(el, () => props.menu!());
        }}
      >
        {props.children}
      </div>
      <PanelResizer of={props.level} />
    </aside>
  );
}
