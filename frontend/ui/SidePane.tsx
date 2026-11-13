import type { JSX } from 'solid-js';
import { t } from '../i18n/t';
import { setSheet, sheet, type Sheet } from '../state/panel';
import { followPointer } from './followPointer';
import { IconButton } from './IconButton';
import { CloseIcon } from './icons';
import { PanelResizer } from './PanelResizer';

/** The sheet a pane dragged to `height` settles as. */
const sheetOf = (height: number): Sheet => (height < window.innerHeight * 0.2 ? 'peek' : height < window.innerHeight * 0.65 ? 'half' : 'full');

/**
 * The top edge of the pane where it is a sheet under the map, on a phone: dragged, it sets
 * how much of the screen the sheet takes; a tap folds it down to its heading or brings it
 * back.
 */
function SheetHandle() {
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
        setSheet(sheetOf(pane.offsetHeight));
        pane.classList.remove('dragging');
        pane.style.height = '';
      },
    );
  };
  const tap = () => {
    if (!dragged) setSheet(sheet() === 'peek' ? 'half' : 'peek');
  };
  const label = () => t('Drag to give the list more or less room; tap to fold it away or bring it back');
  return <button class="sheet-handle" title={label()} aria-label={label()} aria-expanded={sheet() !== 'peek'} onPointerDown={drag} onClick={tap} />;
}

/**
 * The pane between the library and the map, which on a phone is a sheet under the map:
 * its heading, ending in the button that closes it, over what it holds.
 */
export function SidePane(props: { label: string; heading: JSX.Element; onClose: () => void; children: JSX.Element }) {
  return (
    <aside class={`panel side-pane sheet-${sheet()}`} aria-label={props.label}>
      <PanelResizer />
      <SheetHandle />
      <header class="row side-pane-header">
        {props.heading}
        <IconButton label={t('Close {what}', { what: props.label })} onClick={props.onClose}>
          <CloseIcon />
        </IconButton>
      </header>
      {props.children}
    </aside>
  );
}
