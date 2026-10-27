/** Namespace-agnostic reading of an XML document, for GPX files from any writer. */

/** Parses an XML document whose root element has the local name `root`; throws `unreadable` otherwise. */
export function parseXml(text: string, root: string, unreadable: string): Element {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror')[0] || doc.documentElement.localName !== root) throw new Error(unreadable);
  return doc.documentElement;
}

/** Direct children with the given local name, whatever their namespace prefix. */
export function children(element: Element, name: string): Element[] {
  return Array.from(element.children).filter((c) => c.localName === name);
}

export function child(element: Element | undefined, ...path: string[]): Element | undefined {
  let current = element;
  for (const name of path) {
    if (!current) return undefined;
    current = children(current, name)[0];
  }
  return current;
}

/** Trimmed text of the element at `path`, or undefined when it is missing or empty. */
export function text(element: Element | undefined, ...path: string[]): string | undefined {
  const value = child(element, ...path)?.textContent?.trim();
  return value ? value : undefined;
}
