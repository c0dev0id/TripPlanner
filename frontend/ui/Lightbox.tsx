import { t } from '../i18n/t';
import { createEffect, createSignal, Show } from 'solid-js';
import { CloseIcon } from './icons';
import { showModalWhile } from './modal';

/** What is shown over the page: an image, or a document the browser's own viewer shows. */
export interface LightboxImage {
  /** The file itself. */
  src: string;
  /** A small version of an image, shown until the image has loaded; none for a document. */
  preview?: string;
  name: string;
}

const [image, setImage] = createSignal<LightboxImage>();

/** Opens the image over the page from a click on its link, unless the click asks for a new tab. */
export function openImage(e: MouseEvent, shown: LightboxImage): void {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  setImage(shown);
}

/** Opens a PDF over the page from a click on its link, unless the click asks for a new tab or the browser shows no PDF itself: then the link opens it. */
export function openDocument(e: MouseEvent, shown: { src: string; name: string }): void {
  if (e.ctrlKey || e.metaKey || e.shiftKey || navigator.pdfViewerEnabled === false) return;
  e.preventDefault();
  setImage(shown);
}

/** An image or a document over the page, as large as the viewport allows, with its name and a link to the file. */
export function Lightbox() {
  let dialog!: HTMLDialogElement;
  showModalWhile(() => dialog, () => image() !== undefined);
  const [loaded, setLoaded] = createSignal<string>();
  createEffect(() => {
    const shown = image();
    if (!shown?.preview) return;
    const full = new Image();
    full.onload = () => setLoaded(shown.src);
    full.src = shown.src;
  });
  const close = () => setImage(undefined);
  return (
    <dialog ref={dialog} class="lightbox" aria-label={image()?.name ?? t('Photo')} onClose={close} onClick={(e) => e.target === e.currentTarget && close()}>
      <Show when={image()} keyed>
        {(shown) => (
          <figure>
            <Show when={shown.preview} fallback={<iframe src={shown.src} title={shown.name} />}>
              <img src={loaded() === shown.src ? shown.src : shown.preview} alt={shown.name} />
            </Show>
            <figcaption>
              <span class="name" title={shown.name}>
                {shown.name}
              </span>
              <a href={shown.src} target="_blank" rel="noopener">
                {t('Open the file')}
              </a>
              <button type="button" title={t('Close')} aria-label={t('Close')} onClick={close}>
                <CloseIcon />
              </button>
            </figcaption>
          </figure>
        )}
      </Show>
    </dialog>
  );
}
