import { beforeEach, describe, expect, it } from 'vitest';
import { chooseTheme, theme } from './theme';

describe('the theme', () => {
  beforeEach(() => {
    localStorage.clear();
    chooseTheme('system');
  });

  it('sets the document\'s colour scheme and keeps the choice, and clears both for the browser\'s own', () => {
    chooseTheme('dark');
    expect(theme()).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('planner.theme')).toBe('dark');
    chooseTheme('system');
    expect(document.documentElement.style.colorScheme).toBe('');
    expect(localStorage.getItem('planner.theme')).toBeNull();
  });
});
