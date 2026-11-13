/** Asks for a file with the browser's file picker; undefined where none is picked. */
export function pickFile(accept: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files?.[0]));
    input.addEventListener('cancel', () => resolve(undefined));
    input.click();
  });
}

/** Asks for files with the browser's file picker, or with `folder` for a folder with all it holds; none where nothing is picked. */
export function pickFiles(options: { accept?: string; folder?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', multiple: true, accept: options.accept ?? '', webkitdirectory: options.folder === true });
    input.addEventListener('change', () => resolve([...(input.files ?? [])]));
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}
