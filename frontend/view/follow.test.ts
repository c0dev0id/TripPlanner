import { describe, expect, it } from 'vitest';
import { readingLine } from './follow';

describe('readingLine', () => {
  it('lies in the upper half until the page nears its end, and at the foot of the window there', () => {
    expect(readingLine(0, 5000, 1000)).toBe(400);
    expect(readingLine(4400, 5000, 1000)).toBe(400);
    expect(readingLine(4700, 5000, 1000)).toBe(700);
    expect(readingLine(5000, 5000, 1000)).toBe(1000);
  });

  it('goes down over all of the scrolling of a page that is little longer than the window', () => {
    expect(readingLine(0, 200, 1000)).toBe(400);
    expect(readingLine(100, 200, 1000)).toBe(700);
    expect(readingLine(200, 200, 1000)).toBe(1000);
  });

  it('stays in the upper half of a page that does not scroll', () => {
    expect(readingLine(0, 0, 1000)).toBe(400);
  });
});
