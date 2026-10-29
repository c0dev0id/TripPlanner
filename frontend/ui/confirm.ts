import { createSignal } from 'solid-js';

/**
 * Questions asked in the app's own dialog (ConfirmDialog). The browser's `confirm()` is
 * not used: after a few, browsers offer to silence the page's dialogs, and once silenced
 * `confirm()` answers no without asking.
 */

export interface Question {
  message: string;
  /** The labels of the buttons that go ahead, each naming what it does: Delete, Export. The last one is the default. */
  actions: readonly string[];
  resolve: (action: string | undefined) => void;
}

const [question, setQuestion] = createSignal<Question>();
export { question };

/** Asks the question; the action the user picks, undefined when they cancel. A question still open counts as cancelled. */
export function askChoice<A extends string>(message: string, actions: readonly [A, ...A[]]): Promise<A | undefined> {
  question()?.resolve(undefined);
  return new Promise((resolve) => setQuestion({ message, actions, resolve: (action) => resolve(action as A | undefined) }));
}

/** Asks the question; true when the user goes ahead. */
export async function askConfirmation(message: string, action: string): Promise<boolean> {
  return (await askChoice(message, [action])) !== undefined;
}

/** Answers the open question, if any, with an action or, without one, by cancelling. */
export function answerQuestion(action?: string): void {
  const open = question();
  setQuestion(undefined);
  open?.resolve(action);
}
