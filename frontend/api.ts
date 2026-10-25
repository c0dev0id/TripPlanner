/** Requests to the JSON API and the one form the app posts, sign out. */

export interface Me {
  email: string;
  isAdmin: boolean;
}

export async function fetchMe(): Promise<Me> {
  const response = await fetch('/api/me');
  if (!response.ok) throw new Error(`The server answered ${response.status}.`);
  return (await response.json()) as Me;
}

const meta = (name: string): string => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';

/** The CSRF token the page carries, as the hidden fields a form needs. */
export function csrfFields(): [name: string, value: string][] {
  return [
    [meta('csrf-name-key'), meta('csrf-name')],
    [meta('csrf-value-key'), meta('csrf-value')],
  ];
}

/** Signs out by posting the logout form, which ends in a redirect to the landing page. */
export function logout(): void {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = '/logout';
  for (const [name, value] of csrfFields()) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}
