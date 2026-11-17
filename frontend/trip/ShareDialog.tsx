import { t } from '../i18n/t';
import { createResource, createSignal, Show } from 'solid-js';
import { errorMessage, fetchPublication, savePublication, sharedPageUrl, shareTrip, unshareTrip } from '../api';
import type { Publication } from '../model/publication';
import { setShareOpen, shareOpen } from '../state/drawing';
import { openTripId } from '../state/trip';
import { showModalWhile } from '../ui/modal';
import { createRequest } from '../ui/request';

/** The trip's read-only page: a link to print it, sharing it under a public link, and what the shared page shows besides the plan. */
export function ShareDialog() {
  let dialog!: HTMLDialogElement;
  showModalWhile(() => dialog, shareOpen);
  const tripId = () => (shareOpen() ? openTripId() : undefined);
  const [publication, { mutate }] = createResource(tripId, fetchPublication);
  const token = () => publication()?.token;
  const { error, run } = createRequest();
  const [copied, setCopied] = createSignal(false);
  const share = () =>
    run(async () => {
      const { token } = await shareTrip(tripId()!);
      mutate((p) => p && { ...p, token });
    });
  const unshare = () =>
    run(async () => {
      await unshareTrip(tripId()!);
      mutate((p) => p && { ...p, token: null });
    });
  const show = (change: Partial<Publication>) =>
    run(async () => {
      const { journal, gpx, coverEntryId } = { ...publication()!, ...change };
      await savePublication(tripId()!, { journal, gpx, coverEntryId });
      mutate((p) => p && { ...p, ...change });
    });
  const copy = (url: string) =>
    run(async () => {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    });
  return (
    <dialog ref={dialog} class="dialog share-dialog" aria-label={t('Print and share')} onClose={() => setShareOpen(false)}>
      <Show when={tripId()}>
        {(id) => (
          <div class="dialog-body">
            <p>
              <a href={`/trips/${id()}`} target="_blank" rel="noopener">
                {t('Open the read-only page')}
              </a>
              {t(', which shows the days, stops, times and journal for reading and printing.')}
            </p>
            <Show
              when={token()}
              fallback={
                <>
                  <p class="muted">{t('Not shared. Anyone with the link to a shared trip can view its days and stops without signing in, and its journal and photos once you show them on the page.')}</p>
                  <div class="row end">
                    <button type="button" onClick={() => setShareOpen(false)}>
                      {t('Close')}
                    </button>
                    <button type="button" class="primary" onClick={() => void share()} disabled={publication.loading}>
                      {t('Share')}
                    </button>
                  </div>
                </>
              }
            >
              {(shared) => (
                <>
                  <label>
                    {t('Share link')}
                    <input class="url" readonly value={sharedPageUrl(shared())} onFocus={(e) => e.currentTarget.select()} />
                  </label>
                  <label class="toggle">
                    <input type="checkbox" checked={publication()!.journal} onChange={(e) => void show({ journal: e.currentTarget.checked })} /> {t('Show the journal on the page')}
                  </label>
                  <label class="toggle">
                    <input type="checkbox" checked={publication()!.gpx} onChange={(e) => void show({ gpx: e.currentTarget.checked })} /> {t('Offer the trip as a GPX file')}
                  </label>
                  <div class="row end">
                    <button type="button" onClick={() => void unshare()}>
                      {t('Stop sharing')}
                    </button>
                    <button type="button" onClick={() => setShareOpen(false)}>
                      {t('Close')}
                    </button>
                    <button type="button" class="primary" onClick={() => void copy(sharedPageUrl(shared()))}>
                      {t(copied() ? 'Copied' : 'Copy link')}
                    </button>
                  </div>
                </>
              )}
            </Show>
            <Show when={error() ?? (publication.error && errorMessage(publication.error))}>{(message) => <p class="error">{message()}</p>}</Show>
          </div>
        )}
      </Show>
    </dialog>
  );
}
