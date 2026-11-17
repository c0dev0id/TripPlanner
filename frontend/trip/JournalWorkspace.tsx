import { t } from '../i18n/t';
import { onMount, Show } from 'solid-js';
import { setWorkspaceOpen, workspaceOpen } from '../state/journal';
import { openTrip } from '../state/trip';
import { ForById } from '../ui/ForById';
import { isTextField } from '../ui/form';
import { CloseIcon } from '../ui/icons';
import { ChapterEditor } from './JournalEditor';
import { dayLabelOf } from './labels';

/**
 * The journal of the whole trip over the page: every chapter to be written and put in
 * order, the trip's own entries first. Esc closes it, unless a text being written takes it.
 */
export function JournalWorkspace() {
  return (
    <Show when={workspaceOpen() && openTrip()}>
      {(trip) => {
        let layer!: HTMLDivElement;
        const close = () => setWorkspaceOpen(false);
        onMount(() => layer.focus());
        // The keys of the lists under the layer stay with them: what is pressed here is meant here.
        const keys = (e: KeyboardEvent) => {
          e.stopPropagation();
          if (e.key === 'Escape' && !isTextField(e.target)) close();
        };
        return (
          <div ref={layer} class="panel journal-workspace" role="dialog" aria-label={t('Journal')} tabindex={-1} on:keydown={keys}>
            <header>
              <h2 class="name grow" title={trip().name}>
                {t('Journal')} · {trip().name}
              </h2>
              <button type="button" class="icon" title={t('Close')} aria-label={t('Close')} onClick={close}>
                <CloseIcon />
              </button>
            </header>
            <div class="chapters">
              <ForById each={[{ id: '', day: undefined }, ...trip().days.map((day) => ({ id: day.id, day }))]}>
                {(chapter) => (
                  <section>
                    <h3>{chapter().day ? dayLabelOf(trip(), chapter().day!) : t('Introduction')}</h3>
                    <ChapterEditor day={chapter().day} />
                  </section>
                )}
              </ForById>
            </div>
          </div>
        );
      }}
    </Show>
  );
}
