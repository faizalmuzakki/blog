import { marked, Renderer } from 'marked';

// A renderer that blocks dangerous URL schemes in links and images.
// Anything that isn't http/https/mailto/relative is replaced with "#".
function safeHref(href: string | undefined | null): string {
  if (!href) return '#';
  const trimmed = href.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
      return trimmed;
    }
    return '#';
  } catch {
    // Not an absolute URL; treat as relative and allow.
    return trimmed;
  }
}

function safeSrc(src: string | undefined | null): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  try {
    const url = new URL(trimmed, 'https://example.invalid');
    if (url.protocol === 'https:' || url.protocol === 'http:') return trimmed;
    return null;
  } catch {
    return null;
  }
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// In marked 11, Renderer methods use positional args:
//   link(href, title, text): string
//   image(href, title, text): string
//   html(html, block?): string
class SafeRenderer extends Renderer {
  // Override html() to escape raw HTML tokens rather than pass them through.
  // This is the "disable raw HTML" mechanism in marked 11 (there is no html:false option).
  html(html: string): string {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  link(href: string, title: string | null | undefined, text: string): string {
    const safe = safeHref(href);
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
    return `<a href="${escapeAttr(safe)}"${titleAttr}>${text}</a>`;
  }

  image(href: string, title: string | null, text: string): string {
    const safe = safeSrc(href);
    if (!safe) return escapeAttr(text);
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
    return `<img src="${escapeAttr(safe)}" alt="${escapeAttr(text)}"${titleAttr} />`;
  }
}

export function renderMarkdown(src: string): string {
  if (!src) return '';
  return marked.parse(src, {
    gfm: true,
    breaks: true,
    async: false,
    renderer: new SafeRenderer(),
  }) as string;
}
