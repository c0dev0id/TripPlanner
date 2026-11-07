import { t } from '../i18n/t';
import { createResource, createSignal, Show } from 'solid-js';
import { errorMessage, sharedPageUrl, shareToken, shareTrip, unshareTrip } from '../api';
import { setShareOpen, shareOpen } from '../state/drawing';
import { openTripId } from '../state/trip';
import { showModalWhile } from '../ui/modal';
import { createRequest } from '../ui/request';

/** The trip's read-only page: a link to print it, and sharing it under a public link. */
export function ShareDialog() {
  let dialog!: HTMLDialogElement;
  showModalWhile(() => dialog, shareOpen);
  const tripId = () => (shareOpen() ? openTripId() : undefined);
  const [token, { mutate }] = createResource(tripId, async (id) => (await shareToken(id)).token);
  const { error, run } = createRequest();
  const [copied, setCopied] = createSignal(false);
  const share = () =>
    run(async () => {
      mutate((await shareTrip(tripId()!)).token);
    });
  const unshare = () =>
    run(async () => {
      await unshareTrip(tripId()!);
      mutate(null);
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
                {t('Open the trip\'s read-only page')}
              </a>
              {t(', with the days, stops, times and journal laid out for reading and printing.')}
            </p>
            <Show
              when={token()}
              fallback={
                <>
                  <p class="muted">{t('Not shared. Anyone with the link of a shared trip can read it, its journal and its photos, without signing in.')}</p>
                  <div class="row end">
                    <button type="button" onClick={() => setShareOpen(false)}>
                      {t('Close')}
                    </button>
                    <button type="button" class="primary" onClick={() => void share()} disabled={token.loading}>
                      {t('Share')}
                    </button>
                  </div>
                </>
              }
            >
              {(shared) => (
                <>
                  <label>
                    {t('Shared under')}
                    <input class="url" readonly value={sharedPageUrl(shared())} onFocus={(e) => e.currentTarget.select()} />
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
            <Show when={error() ?? (token.error && errorMessage(token.error))}>{(message) => <p class="error">{message()}</p>}</Show>
          </div>
        )}
      </Show>
    </dialog>
  );
}
