/** Namespace-agnostic reading of an XML document, for GPX files from any writer. */

/** The root element of an XML document, or undefined where the text is no XML. */
export function parseXml(text: string): Element | undefined {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  return doc.getElementsByTagName('parsererror')[0] ? undefined : doc.documentElement;
}

/** Direct children with the given local name, whatever their namespace prefix. */
export function children(element: Element, name: string): Element[] {
  return Array.from(element.children).filter((c) => c.localName === name);
}

/** Trimmed text of the first child of that name, or undefined when it is missing or empty. */
export function text(element: Element, name: string): string | undefined {
  return children(element, name)[0]?.textContent?.trim() || undefined;
}
