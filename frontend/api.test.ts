import { beforeEach, describe, expect, it } from 'vitest';
import { csrfFields } from './api';

describe('csrfFields', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="csrf-name-key" content="csrf_name">
      <meta name="csrf-name" content="csrf1234">
      <meta name="csrf-value-key" content="csrf_value">
      <meta name="csrf-value" content="abcdef">`;
  });

  it('reads the token the page carries', () => {
    expect(csrfFields()).toEqual([
      ['csrf_name', 'csrf1234'],
      ['csrf_value', 'abcdef'],
    ]);
  });

  it('gives empty fields where the page carries none', () => {
    document.head.innerHTML = '';
    expect(csrfFields()).toEqual([
      ['', ''],
      ['', ''],
    ]);
  });
});
