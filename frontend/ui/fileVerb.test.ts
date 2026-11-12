import { describe, expect, it } from 'vitest';
import { fileVerb } from './fileVerb';

/** A key press on the page's body, or on `target`. */
function press(init: KeyboardEventInit, target: HTMLElement = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('fileVerb', () => {
  it('reads cut, copy and paste with Ctrl or Cmd', () => {
    expect(fileVerb(press({ key: 'x', ctrlKey: true }))).toBe('cut');
    expect(fileVerb(press({ key: 'C', metaKey: true }))).toBe('copy');
    expect(fileVerb(press({ key: 'v', ctrlKey: true }))).toBe('paste');
  });

  it('reads Delete and Backspace as delete', () => {
    expect(fileVerb(press({ key: 'Delete' }))).toBe('delete');
    expect(fileVerb(press({ key: 'Backspace' }))).toBe('delete');
  });

  it('leaves other keys and other modifiers alone', () => {
    expect(fileVerb(press({ key: 'c' }))).toBeUndefined();
    expect(fileVerb(press({ key: 'z', ctrlKey: true }))).toBeUndefined();
    expect(fileVerb(press({ key: 'c', ctrlKey: true, shiftKey: true }))).toBeUndefined();
    expect(fileVerb(press({ key: 'v', ctrlKey: true, altKey: true }))).toBeUndefined();
  });

  it('leaves a key typed into a field to the field', () => {
    const input = document.body.appendChild(document.createElement('input'));
    expect(fileVerb(press({ key: 'Backspace' }, input))).toBeUndefined();
    expect(fileVerb(press({ key: 'v', ctrlKey: true }, input))).toBeUndefined();
    input.remove();
  });

  it('leaves a press that was handled already', () => {
    const event = press({ key: 'x', ctrlKey: true });
    event.preventDefault();
    expect(fileVerb(event)).toBeUndefined();
  });

  it('leaves a copy to the browser while text is selected', () => {
    const text = document.body.appendChild(document.createElement('p'));
    text.textContent = 'Furka';
    getSelection()!.selectAllChildren(text);
    expect(fileVerb(press({ key: 'c', ctrlKey: true }))).toBeUndefined();
    expect(fileVerb(press({ key: 'x', ctrlKey: true }))).toBe('cut');
    getSelection()!.removeAllRanges();
    text.remove();
  });
});
