/** The trimmed text of a form field. */
export const field = (form: FormData, name: string): string => String(form.get(name) ?? '').trim();

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'file', 'button', 'submit', 'reset', 'color']);

/** Whether keys pressed on the target are typed into it, so that they are no shortcuts. */
export function isTextField(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}
