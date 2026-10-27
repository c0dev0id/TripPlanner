import { Show } from 'solid-js';
import { entryFileUrl, entryPreviewUrl } from '../api';
import { sizeText, type Entry } from '../model/journal';

/** An entry's file as a link that opens it: with a preview for an image, by name otherwise; nothing for a note alone. */
export function EntryFile(props: { entry: Entry; base: string }) {
  return (
    <Show when={props.entry.file}>
      {(file) => (
        <a class="file" href={entryFileUrl(props.base, props.entry.id)} target="_blank" rel="noopener" title={`${file().name}, ${sizeText(file().size)}`}>
          <Show when={file().image} fallback={<span class="file-name">{file().name}</span>}>
            <img src={entryPreviewUrl(props.base, props.entry.id)} alt={file().name} loading="lazy" />
          </Show>
        </a>
      )}
    </Show>
  );
}
