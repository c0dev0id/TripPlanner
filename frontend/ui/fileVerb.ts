import { isTextField } from './form';

/** What the keys of a file manager ask for. */
export type FileVerb = 'cut' | 'copy' | 'paste' | 'delete';

const WITH_CTRL: Record<string, FileVerb> = { x: 'cut', c: 'copy', v: 'paste' };

/**
 * The verb a key press asks for: Ctrl or Cmd with X, C or V, and Delete or Backspace.
 * None for a key typed into a field, while a dialog has the keyboard, for a press that
 * was handled already, and for a copy while text is selected, which the browser copies.
 */
export function fileVerb(e: KeyboardEvent): FileVerb | undefined {
  if (e.defaultPrevented || e.altKey || e.shiftKey || isTextField(e.target) || document.querySelector('dialog:modal')) return undefined;
  if (e.ctrlKey || e.metaKey) {
    const verb = WITH_CTRL[e.key.toLowerCase()];
    return verb === 'copy' && getSelection()?.toString() ? undefined : verb;
  }
  return e.key === 'Delete' || e.key === 'Backspace' ? 'delete' : undefined;
}
