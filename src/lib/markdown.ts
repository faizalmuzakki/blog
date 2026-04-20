import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'blockquote',
  'a',
  'img',
  'strong',
  'em',
  'hr',
  'br',
  'span',
  'del',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class'];

export function renderMarkdown(src: string): string {
  if (!src) return '';
  const html = marked.parse(src, { gfm: true, breaks: true, async: false }) as string;
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
