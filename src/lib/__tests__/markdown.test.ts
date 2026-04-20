import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('# Hello\n\nWorld');
    expect(html).toContain('<h1');
    expect(html).toContain('Hello');
    expect(html).toContain('<p>World</p>');
  });

  it('escapes inline HTML (marked default)', () => {
    // Marked 11 escapes inline HTML when the html extension is not installed.
    const html = renderMarkdown('ok<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('</script>');
    // The literal text <script> should be visible as escaped entities.
    expect(html).toContain('&lt;script&gt;');
  });

  it('neutralizes javascript: hrefs in markdown links', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('javascript:');
    expect(html).toContain('href="#"');
  });

  it('neutralizes data: URIs in images', () => {
    const html = renderMarkdown('![alt](data:image/png;base64,AAAA)');
    // image src stripped → rendered as alt text only
    expect(html).not.toContain('data:');
    expect(html).not.toContain('<img');
  });

  it('preserves https:// links', () => {
    const html = renderMarkdown('[ok](https://example.com)');
    expect(html).toContain('href="https://example.com"');
  });

  it('preserves https:// images', () => {
    const html = renderMarkdown('![alt](https://example.com/x.png)');
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/x.png"');
    expect(html).toContain('alt="alt"');
  });

  it('preserves basic inline formatting', () => {
    const html = renderMarkdown('**bold** and _italic_ and `code`');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
