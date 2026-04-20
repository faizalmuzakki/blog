import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('# Hello\n\nWorld');
    expect(html).toContain('<h1');
    expect(html).toContain('Hello');
    expect(html).toContain('<p>World</p>');
  });

  it('strips <script> tags', () => {
    const html = renderMarkdown('ok<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
  });

  it('strips inline event handlers', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
    expect(html.toLowerCase()).not.toContain('alert(1)');
  });

  it('strips javascript: hrefs', () => {
    const html = renderMarkdown('[x](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });

  it('preserves allowed formatting', () => {
    const html = renderMarkdown('**bold** and _italic_ and `code`');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('preserves https image tags', () => {
    const html = renderMarkdown('![alt](https://example.com/x.png)');
    expect(html).toContain('<img');
    expect(html).toContain('https://example.com/x.png');
    expect(html).toContain('alt="alt"');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
