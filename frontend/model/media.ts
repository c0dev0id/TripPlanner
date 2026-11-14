import type { Entry } from './journal';
import { sizeText } from './journal';

/** A day's additional media: files and links kept with it, each an entry of the kind `media`. */

/** What a file or a link is called: the name given to it, else its file's name, else its address. */
export const mediaName = (entry: Entry): string => entry.text || entry.file?.name || entry.url || '';

/** An address of the web without its scheme and "www.", at most `max` characters of it. */
export function shortAddress(url: string, max = 40): string {
  const plain = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}

/** What stands under the name: a link's address, shortened, or a file's size. */
export const mediaDetail = (entry: Entry): string => (entry.url !== null ? shortAddress(entry.url) : entry.file ? sizeText(entry.file.size) : '');

/** How a click opens it: an image or a PDF over the page, a link in a new tab, any other file as a download. */
export function mediaOpens(entry: Entry): 'image' | 'pdf' | 'link' | 'download' {
  if (entry.url !== null) return 'link';
  if (entry.file?.image) return 'image';
  return entry.file?.mediaType === 'application/pdf' ? 'pdf' : 'download';
}
