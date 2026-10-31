/** Asks for a file with the browser's file picker; undefined where none is picked. */
export function pickFile(accept: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files?.[0]));
    input.addEventListener('cancel', () => resolve(undefined));
    input.click();
  });
}
