import { describe, expect, it } from 'vitest';
import { inkOn, tagsOn } from './tag';

describe('tags', () => {
  it('reads black on a light chip and white on a dark one', () => {
    expect([inkOn('#ffffff'), inkOn('#ffd54f'), inkOn('#1565c0'), inkOn('#000000')]).toEqual(['#000000', '#000000', '#ffffff', '#ffffff']);
  });

  it('lists the tags that are on something in their own order, and none that is no more', () => {
    const tags = [{ id: 2, name: 'Idea', color: '#000000' }, { id: 1, name: 'Ridden', color: '#000000' }];
    expect(tagsOn(tags, [1, 9, 2]).map((tag) => tag.name)).toEqual(['Idea', 'Ridden']);
  });
});
