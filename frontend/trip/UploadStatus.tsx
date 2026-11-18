import { t } from '../i18n/t';
import { For, Show } from 'solid-js';
import { dropUpload, pendingUploads, retryUpload, uploads } from '../state/uploads';
import { counted } from '../ui/format';

/** The files on their way into the journal, and those that failed, each to be tried again or dropped; nothing while there are none. */
export function UploadStatus() {
  const failed = () => uploads().filter((u) => u.error !== undefined);
  return (
    <Show when={uploads().length > 0}>
      <div class="panel upload-status" role="status">
        <Show when={pendingUploads().length > 0}>
          <p>{t('Uploading {files}…', { files: counted(pendingUploads().length, 'file') })}</p>
        </Show>
        <For each={failed()}>
          {(upload) => (
            <p class="error">
              {upload.file.name}: {upload.error}{' '}
              <button type="button" onClick={() => retryUpload(upload.id)}>
                {t('Retry')}
              </button>{' '}
              <button type="button" onClick={() => dropUpload(upload.id)}>
                {t('Discard')}
              </button>
            </p>
          )}
        </For>
      </div>
    </Show>
  );
}
