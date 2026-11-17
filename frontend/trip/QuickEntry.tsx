import { t } from '../i18n/t';
import { createSignal, Show } from 'solid-js';
import { addEntry, closeJournal, journalSpot, journalTarget } from '../state/journal';
import { openTrip, openTripId } from '../state/trip';
import { queueEntries } from '../state/uploads';
import { followPointer } from '../ui/followPointer';
import { isTextField } from '../ui/form';
import { counted } from '../ui/format';
import { showWhile } from '../ui/modal';
import { pickFiles } from '../ui/pickFile';
import { createRequest } from '../ui/request';
import { targetLabel } from './labels';

/** Where the window stands once dragged by its title; centred until then. Kept while the page lives. */
const [windowAt, setWindowAt] = createSignal<{ x: number; y: number }>();

/**
 * A new journal entry for a part of the trip, or for the trip: a text, photos or files,
 * or both. A text and one photo are one entry, the text its caption; otherwise the text
 * is an entry and each file one after it. The files are sent while the page is used for
 * something else. It is a window over the map, not a modal: the map stays usable beside
 * it, and it is dragged aside by its title.
 */
export function QuickEntry() {
  let dialog!: HTMLDialogElement;
  let text!: HTMLTextAreaElement;
  showWhile(() => dialog, () => journalTarget() !== undefined);
  const { error, busy, run } = createRequest();
  const [files, setFiles] = createSignal<File[]>([]);
  const close = () => {
    setFiles([]);
    closeJournal();
  };
  const add = (e: SubmitEvent) => {
    e.preventDefault();
    const written = text.value.trim();
    const chosen = files();
    if (!written && chosen.length === 0) return;
    const [tripId, target, spot] = [openTripId()!, journalTarget()!, journalSpot()];
    const onTrip = Object.keys(target).length === 0;
    void run(async () => {
      const caption = chosen.length === 1 && written !== '';
      if (written && !caption) await addEntry(tripId, target, { text: written, spot });
      queueEntries(tripId, target, chosen, { text: caption ? written : undefined, spot, byDate: onTrip });
      text.value = '';
      close();
    });
  };
  /** Moves the window with the pointer that pressed its title, kept whole inside the page. */
  const drag = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const box = dialog.getBoundingClientRect();
    const grip = { x: e.clientX - box.left, y: e.clientY - box.top };
    const within = (at: number, size: number, room: number) => Math.min(Math.max(at, 0), Math.max(room - size, 0));
    followPointer(e, (p) => setWindowAt({ x: within(p.clientX - grip.x, box.width, innerWidth), y: within(p.clientY - grip.y, box.height, innerHeight) }));
  };
  /** Esc closes the window, unless the text being written takes it; Ctrl and Enter add the entry. */
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) dialog.querySelector('form')!.requestSubmit();
    if (e.key !== 'Escape' || isTextField(e.target)) return;
    e.preventDefault();
    close();
  };
  return (
    <dialog
      ref={dialog}
      class="dialog journal-dialog"
      classList={{ placed: windowAt() !== undefined }}
      style={windowAt() && { left: `${windowAt()!.x}px`, top: `${windowAt()!.y}px` }}
      aria-label={t('New journal entry')}
      onClose={close}
      on:keydown={keys}
    >
      <Show when={journalTarget()}>
        {(target) => {
          const label = () => targetLabel(openTrip()!, target()) ?? '';
          return (
            <form class="dialog-body" onSubmit={add}>
              <h3 class="name grip" title={label()} onPointerDown={drag}>
                {t('New journal entry')} · {label()}
              </h3>
              <textarea ref={(el) => ((text = el), setTimeout(() => el.focus()))} rows={4} maxlength={20000} placeholder={t('Write what happened. Markdown works.')} />
              <Show when={files().length > 0}>
                <p class="muted hint">{counted(files().length, 'file')}</p>
              </Show>
              <Show when={error()}>{(message) => <p class="error">{message()}</p>}</Show>
              <div class="row end">
                <button type="button" class="start" onClick={() => void pickFiles({}).then((picked) => setFiles((held) => [...held, ...picked]))}>
                  {t('Photos or files…')}
                </button>
                <button type="button" onClick={close}>
                  {t('Close')}
                </button>
                <button type="submit" class="primary" disabled={busy()}>
                  {t('Add')}
                </button>
              </div>
            </form>
          );
        }}
      </Show>
    </dialog>
  );
}
