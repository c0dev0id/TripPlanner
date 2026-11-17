import { t } from '../i18n/t';
import { createEffect, createSignal, Show } from 'solid-js';
import { ChevronIcon, ChevronLeftIcon, CloseIcon } from './icons';
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
/** The images the one shown is stepped among: a gallery's; the one alone otherwise. */
const [among, setAmong] = createSignal<readonly LightboxImage[]>([]);

/** Opens the image over the page from a click on its link, unless the click asks for a new tab. With `gallery`, the images it belongs to, the one before and the one after are a step away. */
export function openImage(e: MouseEvent, shown: LightboxImage, gallery: readonly LightboxImage[] = [shown]): void {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  setAmong(gallery);
  setImage(shown);
}

/** Opens a PDF over the page from a click on its link, unless the click asks for a new tab or the browser shows no PDF itself: then the link opens it. */
export function openDocument(e: MouseEvent, shown: { src: string; name: string }): void {
  if (e.ctrlKey || e.metaKey || e.shiftKey || navigator.pdfViewerEnabled === false) return;
  e.preventDefault();
  setAmong([shown]);
  setImage(shown);
}

/** An image or a document over the page, as large as the viewport allows, with its name and a link to the file; an image of a gallery with the steps to the one before and after, which the arrow keys take too. */
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
  const step = (by: number) => {
    const next = among()[among().findIndex((i) => i.src === image()?.src) + by];
    if (next) setImage(next);
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  };
  return (
    <dialog ref={dialog} class="lightbox" aria-label={image()?.name ?? t('Photo')} onClose={close} onClick={(e) => e.target === e.currentTarget && close()} onKeyDown={keys}>
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
              <Show when={among().length > 1}>
                <button type="button" title={t('Previous')} aria-label={t('Previous')} disabled={among()[0]?.src === shown.src} onClick={() => step(-1)}>
                  <ChevronLeftIcon />
                </button>
                <button type="button" title={t('Next')} aria-label={t('Next')} disabled={among().at(-1)?.src === shown.src} onClick={() => step(1)}>
                  <ChevronIcon />
                </button>
              </Show>
              <a href={shown.src} target="_blank" rel="noopener">
                {t('Open file')}
              </a>
              {/* Focused first: a document's frame would take the keys otherwise, Escape among them. */}
              <button type="button" title={t('Close')} aria-label={t('Close')} autofocus onClick={close}>
                <CloseIcon />
              </button>
            </figcaption>
          </figure>
        )}
      </Show>
    </dialog>
  );
}
