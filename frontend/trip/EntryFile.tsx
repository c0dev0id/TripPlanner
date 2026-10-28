import { Show } from 'solid-js';
import { entryFileUrl, entryPreviewUrl } from '../api';
import { sizeText, type Entry } from '../model/journal';
import { openImage } from '../ui/Lightbox';

/** An entry's file as a link: an image by its preview, opened over the page; another file by name, opened in a tab; nothing for a note alone. */
export function EntryFile(props: { entry: Entry; base: string }) {
  const url = () => entryFileUrl(props.base, props.entry.id);
  const open = (e: MouseEvent) => {
    const file = props.entry.file!;
    if (file.image) openImage(e, { src: url(), preview: entryPreviewUrl(props.base, props.entry.id), name: file.name });
  };
  return (
    <Show when={props.entry.file}>
      {(file) => (
        <a class="file" href={url()} target="_blank" rel="noopener" title={`${file().name}, ${sizeText(file().size)}`} onClick={open}>
          <Show when={file().image} fallback={<span class="file-name">{file().name}</span>}>
            <img src={entryPreviewUrl(props.base, props.entry.id)} alt={file().name} loading="lazy" />
          </Show>
        </a>
      )}
    </Show>
  );
}
