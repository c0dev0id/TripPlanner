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

/** The images the one shown is stepped among, a gallery's or the one alone, and which of them is shown; nothing while the lightbox is closed. */
const [showing, setShowing] = createSignal<{ images: readonly LightboxImage[]; at: number }>();

/** Opens the image over the page from a click on its link, unless the click asks for a new tab. With `gallery`, the images it belongs to, the one before and the one after are a step away. */
export function openImage(e: MouseEvent, image: LightboxImage, gallery: readonly LightboxImage[] = [image]): void {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  setShowing({ images: gallery, at: gallery.indexOf(image) });
}

/** Opens a PDF over the page from a click on its link, unless the click asks for a new tab or the browser shows no PDF itself: then the link opens it. */
export function openDocument(e: MouseEvent, document: { src: string; name: string }): void {
  if (e.ctrlKey || e.metaKey || e.shiftKey || navigator.pdfViewerEnabled === false) return;
  e.preventDefault();
  setShowing({ images: [document], at: 0 });
}

/** An image or a document over the page, as large as the viewport allows, with its name; a click on an image closes it, and a document has a link to its file; an image of a gallery with the steps to the one before and after, which the arrow keys take too. */
export function Lightbox() {
  let dialog!: HTMLDialogElement;
  const image = () => showing()?.images[showing()!.at];
  showModalWhile(() => dialog, () => image() !== undefined);
  const [loaded, setLoaded] = createSignal<string>();
  createEffect(() => {
    const now = image();
    if (!now?.preview) return;
    const full = new Image();
    full.onload = () => setLoaded(now.src);
    full.src = now.src;
  });
  const close = () => setShowing(undefined);
  const step = (by: number) => setShowing((s) => (s && s.images[s.at + by] ? { ...s, at: s.at + by } : s));
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
              <img src={loaded() === shown.src ? shown.src : shown.preview} alt={shown.name} onClick={close} />
            </Show>
            <figcaption>
              <span class="name" title={shown.name}>
                {shown.name}
              </span>
              <Show when={showing()!.images.length > 1}>
                <button type="button" title={t('Previous')} aria-label={t('Previous')} disabled={showing()!.at === 0} onClick={() => step(-1)}>
                  <ChevronLeftIcon />
                </button>
                <button type="button" title={t('Next')} aria-label={t('Next')} disabled={showing()!.at === showing()!.images.length - 1} onClick={() => step(1)}>
                  <ChevronIcon />
                </button>
              </Show>
              <Show when={!shown.preview}>
                <a href={shown.src} target="_blank" rel="noopener">
                  {t('Open file')}
                </a>
              </Show>
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
