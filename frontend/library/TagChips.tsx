import { For, Show } from 'solid-js';
import { t } from '../i18n/t';
import { inkOn, tagsOn, type Tag } from '../model/tag';
import { toggleWanted, wantedTags } from '../state/library';
import { tags } from '../state/tags';

const chipStyle = (tag: Tag) => ({ background: tag.color, color: inkOn(tag.color) });

/** The tags that are on a trip, each a chip in its colour; nothing for a trip without one. */
export function TagChips(props: { ids: readonly number[] }) {
  const on = () => tagsOn(tags(), props.ids);
  return (
    <Show when={on().length > 0}>
      <span class="chips">
        <For each={on()}>
          {(tag) => (
            <span class="chip tag-chip" style={chipStyle(tag)}>
              {tag.name}
            </span>
          )}
        </For>
      </span>
    </Show>
  );
}

/** The user's tags as switches over the trips: those pressed limit the list to the trips that have them all. Nothing while there is no tag. */
export function TagFilter() {
  return (
    <Show when={tags().length > 0}>
      <div class="chips tag-filter" role="group" aria-label={t('Filter by tag')}>
        <For each={tags()}>
          {(tag) => (
            <button type="button" class="chip tag-chip" style={chipStyle(tag)} aria-pressed={wantedTags().has(tag.id)} onClick={() => toggleWanted(tag.id)}>
              {tag.name}
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}
