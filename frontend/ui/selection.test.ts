import { describe, expect, it } from 'vitest';
import { clickSelect, menuSelection, NOTHING_SELECTED, type Selection } from './selection';

const order = ['a', 'b', 'c', 'd'];
const plain = { metaKey: false, ctrlKey: false, shiftKey: false };
const cmd = { ...plain, metaKey: true };
const ctrl = { ...plain, ctrlKey: true };
const shift = { ...plain, shiftKey: true };
const keys = (s: Selection<string>) => [...s.keys].sort();

describe('clickSelect', () => {
  it('selects the clicked row alone', () => {
    const s = clickSelect({ keys: new Set(['a', 'b']), anchor: 'a' }, order, 'c', plain);
    expect([keys(s), s.anchor]).toEqual([['c'], 'c']);
  });

  it('adds or takes away a row with Cmd or Ctrl, in the order selected', () => {
    const added = clickSelect(clickSelect(NOTHING_SELECTED, order, 'a', plain), order, 'c', cmd);
    expect([...clickSelect(added, order, 'b', ctrl).keys]).toEqual(['a', 'c', 'b']);
    expect(keys(clickSelect(added, order, 'a', cmd))).toEqual(['c']);
  });

  it('selects the rows from the anchor with Shift, either way, the anchor first', () => {
    const start = clickSelect(NOTHING_SELECTED, order, 'b', plain);
    expect(keys(clickSelect(start, order, 'd', shift))).toEqual(['b', 'c', 'd']);
    const back = clickSelect(clickSelect(start, order, 'd', shift), order, 'a', shift);
    expect([[...back.keys], back.anchor]).toEqual([['b', 'a'], 'b']);
  });

  it('selects the row alone on Shift without an anchor', () => {
    expect(keys(clickSelect(NOTHING_SELECTED, order, 'c', shift))).toEqual(['c']);
  });
});

describe('menuSelection', () => {
  it('keeps a selection that holds the row, else takes the row alone', () => {
    const two: Selection<string> = { keys: new Set(['a', 'b']), anchor: 'a' };
    expect(menuSelection(two, 'b')).toBe(two);
    expect(menuSelection(two, 'c')).toEqual({ keys: new Set(['c']), anchor: 'c' });
  });
});
