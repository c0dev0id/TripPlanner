import { micromark } from 'micromark';

/**
 * A text written as Markdown, as HTML to be set into the page. HTML in the text is
 * shown as written, never run; an image is a link to it, since the journal's pictures are
 * its entries; an indented line is a line, not code; links open apart from the page.
 */
export function markdownHtml(text: string): string {
  const html = micromark(text, { extensions: [{ disable: { null: ['labelStartImage', 'codeIndented', 'htmlFlow', 'htmlText'] } }] });
  // Text is escaped in what micromark writes, so `<a href=` only ever begins a link.
  return html.replaceAll('<a href=', '<a target="_blank" rel="noopener noreferrer" href=');
}
