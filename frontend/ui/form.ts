/** The trimmed text of a form field. */
export const field = (form: FormData, name: string): string => String(form.get(name) ?? '').trim();
