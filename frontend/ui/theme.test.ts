import { beforeEach, describe, expect, it } from 'vitest';
import { chooseTheme, theme } from './theme';

describe('the theme', () => {
  beforeEach(() => {
    localStorage.clear();
    chooseTheme('system');
  });

  it('marks the document and keeps the choice, and forgets both for the browser\'s own', () => {
    chooseTheme('dark');
    expect(theme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('planner.theme')).toBe('dark');
    chooseTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('planner.theme')).toBeNull();
  });
});
