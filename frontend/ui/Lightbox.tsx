import { t } from '../i18n/t';
import { batch, createEffect, createSignal, Show } from 'solid-js';
import { ChevronIcon, ChevronLeftIcon, CloseIcon } from './icons';
import { showModalWhile } from './modal';

/** What is shown over the page: an image, or a document the browser's own viewer shows. */
export interface LightboxImage {
  /** The file itself. */
  src: string;
  /** A small version of an image, shown until the image has loaded; none for a document. */
  preview?: string;
  name: string;
  /** What is written on an image, as HTML, in place of its name; nothing for an empty one. */
  caption?: string;
}

/** The images the one asked for is stepped among, a gallery's or the one alone, and which of them it is; kept after the lightbox has closed. */
const [showing, setShowing] = createSignal<{ images: readonly LightboxImage[]; at: number }>();
/** Whether the lightbox is asked for. */
const [open, setOpen] = createSignal(false);
/** What the frame holds, and an image's width by its height: set once that is known, and kept while the frame fades. */
const [shown, setShown] = createSignal<{ image: LightboxImage; ratio?: number }>();

function show(images: readonly LightboxImage[], at: number): void {
  batch(() => {
    setShown(undefined);
    setShowing({ images, at });
    setOpen(true);
  });
}

/** Opens the image over the page from a click on its link, unless the click asks for a new tab. With `gallery`, the images it belongs to, the one before and the one after are a step away. */
export function openImage(e: MouseEvent, image: LightboxImage, gallery: readonly LightboxImage[] = [image]): void {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  show(gallery, gallery.indexOf(image));
}

/** Opens a PDF over the page from a click on its link, unless the click asks for a new tab or the browser shows no PDF itself: then the link opens it. */
export function openDocument(e: MouseEvent, document: { src: string; name: string }): void {
  if (e.ctrlKey || e.metaKey || e.shiftKey || navigator.pdfViewerEnabled === false) return;
  e.preventDefault();
  show([document], 0);
}

/**
 * An image or a document over the page in a frame that fades in and out, an image with its caption or name and its buttons on it,
 * a document with its name and a link to its file under it. A click on an image closes it; an image of a gallery has
 * the steps to the one before and after, which the arrow keys take too. An image comes once its small version says what shape it has, so the frame is of
 * its size from the first.
 */
export function Lightbox() {
  let dialog!: HTMLDialogElement;
  const image = () => showing()?.images[showing()!.at];
  showModalWhile(() => dialog, () => open() && shown() !== undefined);
  const [loaded, setLoaded] = createSignal<string>();
  createEffect(() => {
    const now = image();
    if (!now) return;
    if (!now.preview) return setShown({ image: now });
    const small = new Image();
    small.onload = small.onerror = () => image() === now && setShown({ image: now, ratio: small.naturalWidth / small.naturalHeight || 1.5 });
    small.src = now.preview;
    const full = new Image();
    full.onload = () => setLoaded(now.src);
    full.src = now.src;
  });
  const close = () => setOpen(false);
  const step = (by: number) => setShowing((s) => (s && s.images[s.at + by] ? { ...s, at: s.at + by } : s));
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  };
  return (
    <dialog ref={dialog} class="lightbox" aria-label={shown()?.image.name ?? t('Photo')} onClose={close} onClick={(e) => e.target === e.currentTarget && close()} onKeyDown={keys}>
      <Show when={shown()} keyed>
        {({ image: shown, ratio }) => (
          <figure>
            <Show when={shown.preview} fallback={<iframe src={shown.src} title={shown.name} />}>
              <img src={loaded() === shown.src ? shown.src : shown.preview} alt={shown.name} style={{ '--ratio': ratio }} onClick={close} />
              <Show when={shown.caption !== undefined} fallback={<figcaption class="on-image">{shown.name}</figcaption>}>
                <Show when={shown.caption}>
                  <figcaption class="on-image" innerHTML={shown.caption} />
                </Show>
              </Show>
              <Show when={showing()!.images.length > 1}>
                <button type="button" class="disk previous" title={t('Previous')} aria-label={t('Previous')} disabled={showing()!.at === 0} onClick={() => step(-1)}>
                  <ChevronLeftIcon />
                </button>
                <button type="button" class="disk next" title={t('Next')} aria-label={t('Next')} disabled={showing()!.at === showing()!.images.length - 1} onClick={() => step(1)}>
                  <ChevronIcon />
                </button>
              </Show>
              <button type="button" class="disk close" title={t('Close')} aria-label={t('Close')} autofocus onClick={close}>
                <CloseIcon />
              </button>
            </Show>
            <Show when={!shown.preview}>
              <figcaption class="bar">
                <span class="name" title={shown.name}>
                  {shown.name}
                </span>
                <a href={shown.src} target="_blank" rel="noopener">
                  {t('Open file')}
                </a>
                {/* Focused first: a document's frame would take the keys otherwise, Escape among them. */}
                <button type="button" title={t('Close')} aria-label={t('Close')} autofocus onClick={close}>
                  <CloseIcon />
                </button>
              </figcaption>
            </Show>
          </figure>
        )}
      </Show>
    </dialog>
  );
}
