import { describe, expect, it } from 'vitest';
import { markdownHtml } from './markdown';

describe('Markdown', () => {
  it('writes paragraphs, emphasis, lists and headings', () => {
    expect(markdownHtml('Over the *Furka*.\n\n- fuel\n- coffee')).toBe('<p>Over the <em>Furka</em>.</p>\n<ul>\n<li>fuel</li>\n<li>coffee</li>\n</ul>');
    expect(markdownHtml('## The pass')).toBe('<h2>The pass</h2>');
  });

  it('opens links apart and follows none that would run something', () => {
    expect(markdownHtml('[the hut](https://example.org/hut)')).toBe('<p><a target="_blank" rel="noopener noreferrer" href="https://example.org/hut">the hut</a></p>');
    expect(markdownHtml('[x](javascript:alert(1))')).toBe('<p><a target="_blank" rel="noopener noreferrer" href="">x</a></p>');
  });

  it('shows HTML as written and makes an image a link', () => {
    expect(markdownHtml('<img src=x onerror=alert(1)> and <a href=">b</a>')).not.toContain('<img');
    expect(markdownHtml('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(markdownHtml('![view](https://example.org/a.jpg)')).toBe('<p>!<a target="_blank" rel="noopener noreferrer" href="https://example.org/a.jpg">view</a></p>');
  });

  it('keeps an indented line a line', () => {
    expect(markdownHtml('Then:\n\n    straight on')).toBe('<p>Then:</p>\n<p>straight on</p>');
  });
});
