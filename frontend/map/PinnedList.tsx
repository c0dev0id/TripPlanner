import { createSignal, Show } from 'solid-js';
import { t } from '../i18n/t';
import { pinnedRows } from '../state/pinnedLines';
import { ForById } from '../ui/ForById';
import { ChevronIcon, CloseIcon, TackedIcon } from '../ui/icons';

/**
 * All that is pinned to the map, as a card in the map's top right corner: each with the
 * colour of its line, its name, where it is found, and a button that lets go of it. The
 * card folds to its heading and is not there while nothing is pinned.
 */
export function PinnedList() {
  const [folded, setFolded] = createSignal(false);
  return (
    <Show when={pinnedRows().length > 0}>
      <section class="map-card pinned-card">
        <h3>
          <button class="row fold" aria-expanded={!folded()} onClick={() => setFolded(!folded())}>
            <TackedIcon />
            <span class="grow">{t('Pinned')}</span>
            <span class="muted">{pinnedRows().length}</span>
            <ChevronIcon />
          </button>
        </h3>
        <Show when={!folded()}>
          <ul>
            <ForById each={pinnedRows()}>
              {(row) => (
                <li class="row">
                  <span class="swatch" style={{ background: row().color }} />
                  <span class="lines grow">
                    <span class="name">{row().name}</span>
                    <span class="muted detail name">{row().where.join(' › ')}</span>
                  </span>
                  <button class="icon" title={t('Unpin {what} from the map', { what: row().name })} aria-label={t('Unpin {what} from the map', { what: row().name })} onClick={() => row().unpin()}>
                    <CloseIcon />
                  </button>
                </li>
              )}
            </ForById>
          </ul>
        </Show>
      </section>
    </Show>
  );
}
