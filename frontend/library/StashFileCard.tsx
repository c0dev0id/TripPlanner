import { For, Show } from 'solid-js';
import { t } from '../i18n/t';
import type { StashFile, StashItem } from '../model/stash';
import { isShownItem, shownInStash, stashColor } from '../state/stash';
import { cardMenu } from '../ui/cardMenu';
import { counted, distanceText, momentText } from '../ui/format';
import { FileIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { Pad } from '../ui/Pad';
import type { CardSelect } from './Library';
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
export function StashItemRow(props: { file: StashFile; item: StashItem; where?: string; onShow: (item: StashItem) => void; items: () => MenuItem[] }) {
  return (
    <li class="card" classList={{ opened: isShownItem(props.file.id, props.item) }}>
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <button class="text grow" onClick={() => props.onShow(props.item)}>
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
 * A file of the Stash as a card: its name over what it holds, with its shape, small.
 * Unfolded, it lists its routes and tracks, and says how many waypoints it holds. It is
 * marked while the map shows it whole, as its route or track is that is shown alone.
 */
export function StashFileCard(props: {
  file: StashFile;
  where?: string;
  onOpen: (file: StashFile) => void;
  onShow: (item: StashItem) => void;
  items: () => MenuItem[];
  /** The menu of one of its routes or tracks. */
  itemItems: (item: StashItem) => MenuItem[];
  select: CardSelect;
  /** Whether its routes and tracks are listed under it; not among what a search found. */
  unfolded?: boolean;
}) {
  /** Whether the map shows the file whole. */
  const shown = () => shownInStash()?.fileId === props.file.id && !shownInStash()!.item;
  return (
    <li class="card" classList={{ selected: props.select.selected(), cut: props.select.cut(), opened: shown() }}>
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
          <For each={props.file.items}>{(item) => <StashItemRow file={props.file} item={item} onShow={props.onShow} items={() => props.itemItems(item)} />}</For>
          <Show when={props.file.waypoints > 0}>
            <li class="muted detail">{counted(props.file.waypoints, 'waypoint')}</li>
          </Show>
        </ul>
      </Show>
    </li>
  );
}
