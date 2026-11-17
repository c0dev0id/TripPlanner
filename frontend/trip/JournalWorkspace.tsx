import { t } from '../i18n/t';
import { createSignal, onMount, Show } from 'solid-js';
import { publicPreviewUrl, sharedPageUrl, tripApi, entryImageUrl } from '../api';
import { allEntries, setWorkspaceOpen, workspaceOpen } from '../state/journal';
import { openPublication, publish, setShared } from '../state/publication';
import { openTrip } from '../state/trip';
import { ForById } from '../ui/ForById';
import { isTextField } from '../ui/form';
import { CloseIcon } from '../ui/icons';
import { createRequest } from '../ui/request';
import { ChapterEditor } from './JournalEditor';
import { dayLabelOf } from './labels';

/** What the trip's page shows to whom: the link it is shared under, the journal and the GPX file on it, and its cover. */
function PageSettings(props: { tripId: number }) {
  const { error, run } = createRequest();
  const [copied, setCopied] = createSignal(false);
  const cover = () => allEntries().find((e) => e.id === openPublication()?.coverEntryId);
  const copy = (url: string) =>
    run(async () => {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    });
  return (
    <Show when={openPublication()}>
      {(publication) => (
        <div class="page-settings">
          <label class="toggle">
            <input type="checkbox" checked={publication().token !== null} onChange={(e) => void run(() => setShared(e.currentTarget.checked))} /> {t('Share the page under a link')}
          </label>
          <Show when={publication().token}>
            {(token) => (
              <span class="share-link">
                <input class="url" readonly aria-label={t('Share link')} value={sharedPageUrl(token())} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" onClick={() => void copy(sharedPageUrl(token()))}>
                  {t(copied() ? 'Copied' : 'Copy link')}
                </button>
              </span>
            )}
          </Show>
          <label class="toggle">
            <input type="checkbox" checked={publication().journal} onChange={(e) => void run(() => publish({ journal: e.currentTarget.checked }))} /> {t('Show the journal on the page')}
          </label>
          <label class="toggle">
            <input type="checkbox" checked={publication().gpx} onChange={(e) => void run(() => publish({ gpx: e.currentTarget.checked }))} /> {t('Offer the trip as a GPX file')}
          </label>
          <Show when={cover()} fallback={<span class="muted">{t('No cover: a photo is made the cover from its menu.')}</span>}>
            {(entry) => (
              <span class="cover">
                <img src={entryImageUrl(tripApi(props.tripId), entry(), 400)} alt="" /> {t('Cover')}
                <button type="button" onClick={() => void run(() => publish({ coverEntryId: null }))}>
                  {t('Remove')}
                </button>
              </span>
            )}
          </Show>
          <a href={`/trips/${props.tripId}`} target="_blank" rel="noopener">
            {t('Open the page for printing')}
          </a>
          <Show when={error()}>{(message) => <span class="error">{message()}</span>}</Show>
        </div>
      )}
    </Show>
  );
}

/**
 * The journal of the whole trip over the page, and the page it is shared on: every
 * chapter to be written and put in order, the trip's own entries first; beside it the
 * page as a visitor gets it, which follows what is written; above both what the page
 * shows to whom. Esc closes it, unless a text being written takes it.
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
              <a class="preview-link" href={publicPreviewUrl(trip().id)} target="_blank" rel="noopener">
                {t('Preview in a window of its own')}
              </a>
              <button type="button" class="icon" title={t('Close')} aria-label={t('Close')} onClick={close}>
                <CloseIcon />
              </button>
            </header>
            <PageSettings tripId={trip().id} />
            <div class="columns">
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
              <iframe class="preview" title={t('The page as a visitor sees it')} src={publicPreviewUrl(trip().id)} />
            </div>
          </div>
        );
      }}
    </Show>
  );
}
