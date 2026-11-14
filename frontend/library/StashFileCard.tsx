import { Show, type JSX } from 'solid-js';
import { t } from '../i18n/t';
import type { StashFile, StashItem } from '../model/stash';
import { isShownItem, isShownWhole, stashColor } from '../state/stash';
import { cardMenu } from '../ui/cardMenu';
import { counted, distanceText, momentText } from '../ui/format';
import { FileIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { Pad } from '../ui/Pad';
import type { CardSelect, RowSelect } from './Library';
import { TripShape } from './TripShape';

/** What a route or a track of a file is called: its name, or what it is where it has none. */
export const stashItemName = (item: StashItem): string => item.name || (item.kind === 'track' ? t('Unnamed track') : t('Unnamed route'));

/** What a file holds, as its card says it: its routes, tracks and waypoints, and how far the routes and tracks go together. */
function heldIn(file: StashFile): string {
  const count = (kind: StashItem['kind']) => file.items.filter((item) => item.kind === kind).length;
  const distanceM = file.items.reduce((sum, item) => sum + item.distanceM, 0);
  return [
    count('route') > 0 && counted(count('route'), 'route'),
    count('track') > 0 && counted(count('track'), 'track'),
    file.waypoints > 0 && counted(file.waypoints, 'waypoint'),
    distanceM > 0 && distanceText(distanceM),
  ]
    .filter(Boolean)
    .join(' · ') || t('Empty');
}

/** A route or a track of a file as a row: its name over what it is, how far it goes and, of a track with times, when it began; a click shows it alone on the map, in the colour its row has, and its menu takes it out of the Stash. */
export function StashItemRow(props: { file: StashFile; item: StashItem; where?: string; onShow: (item: StashItem) => void; items: () => MenuItem[]; select: RowSelect }) {
  return (
    <li class="card" classList={{ selected: props.select.selected(), opened: isShownItem(props.file.id, props.item) }}>
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Pad label={t('Select {name}', { name: stashItemName(props.item) })} selected={props.select.selected()} onToggle={props.select.onToggle} />
        <button class="text grow" onClick={(e) => props.select.onClick(e) || props.onShow(props.item)}>
          <span class="swatch" style={{ background: stashColor(props.file, props.item) }} />
          <span class="lines">
            <span class="name">{stashItemName(props.item)}</span>
            <span class="muted detail">
              {[props.item.kind === 'track' ? t('Track') : t('Route'), props.where, props.item.distanceM > 0 && distanceText(props.item.distanceM), props.item.startedAt && momentText(props.item.startedAt)]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        </button>
        <MenuButton of={stashItemName(props.item)} items={props.items} />
      </div>
    </li>
  );
}

/**
 * A file of the Stash as a card: its name over what it holds, with its shape, small. It
 * is marked while the map shows it whole. With `children`, the rows of its routes and
 * tracks, it is unfolded: they stand under it, over how many waypoints it holds.
 */
export function StashFileCard(props: { file: StashFile; where?: string; onOpen: (file: StashFile) => void; items: () => MenuItem[]; select: CardSelect; unfolded?: boolean; children?: JSX.Element }) {
  return (
    <li class="card" classList={{ selected: props.select.selected(), opened: isShownWhole(props.file.id) }}>
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Pad label={t('Select {name}, or drag it into a folder', { name: props.file.name })} selected={props.select.selected()} onToggle={props.select.onToggle} onPress={props.select.onDrag} />
        <button class="text grow" aria-expanded={props.unfolded} onClick={(e) => props.select.onClick(e) || props.onOpen(props.file)}>
          <FileIcon />
          <span class="lines">
            <span class="name">{props.file.name}</span>
            <span class="muted detail">{[props.where, heldIn(props.file)].filter(Boolean).join(' · ')}</span>
          </span>
          <Show when={props.file.items.length > 0}>
            <TripShape days={[props.file.items.map((item) => ({ line: item.line, color: stashColor(props.file, item) }))]} />
          </Show>
        </button>
        <MenuButton of={props.file.name} items={props.items} />
      </div>
      <Show when={props.unfolded}>
        <ul class="tree-children">
          {props.children}
          <Show when={props.file.waypoints > 0}>
            <li class="muted detail">{counted(props.file.waypoints, 'waypoint')}</li>
          </Show>
        </ul>
      </Show>
    </li>
  );
}
