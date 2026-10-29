import { describe, expect, it } from 'vitest';
import { clickSelect, NOTHING_SELECTED, type Selection } from './selection';

const order = ['a', 'b', 'c', 'd'];
const plain = { toggle: false, range: false };
const toggle = { toggle: true, range: false };
const range = { toggle: false, range: true };
const keys = (s: Selection) => [...s.keys].sort();

describe('clickSelect', () => {
  it('selects the clicked row alone', () => {
    const s = clickSelect({ keys: new Set(['a', 'b']), anchor: 'a' }, order, 'c', plain);
    expect([keys(s), s.anchor]).toEqual([['c'], 'c']);
  });

  it('adds or takes away a row with Cmd or Ctrl', () => {
    const added = clickSelect(clickSelect(NOTHING_SELECTED, order, 'a', plain), order, 'c', toggle);
    expect(keys(added)).toEqual(['a', 'c']);
    expect(keys(clickSelect(added, order, 'a', toggle))).toEqual(['c']);
  });

  it('selects the rows from the anchor with Shift, either way', () => {
    const start = clickSelect(NOTHING_SELECTED, order, 'b', plain);
    expect(keys(clickSelect(start, order, 'd', range))).toEqual(['b', 'c', 'd']);
    const back = clickSelect(clickSelect(start, order, 'd', range), order, 'a', range);
    expect([keys(back), back.anchor]).toEqual([['a', 'b'], 'b']);
  });

  it('selects the row alone on Shift without an anchor', () => {
    expect(keys(clickSelect(NOTHING_SELECTED, order, 'c', range))).toEqual(['c']);
  });
});
