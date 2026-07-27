import { marked } from 'marked';
import katex from 'katex';

/**
 * Render a piece of text containing Markdown and LaTeX to HTML.
 *
 * Supports:
 *   - Standard Markdown (via `marked`)
 *   - Block math:  $$...$$
 *   - Inline math: $...$
 *
 * Renders on the server at build time; consumers get a static HTML string.
 */
export function renderMathMarkdown(input: string): string {
  if (!input) return '';

  // Pull out math segments first so marked can't touch them.
  const placeholders: string[] = [];
  const withPlaceholders = input
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr: string) => {
      let html: string;
      try {
        html = katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
      } catch {
        html = `<code>${escapeHtml('$$' + expr + '$$')}</code>`;
      }
      placeholders.push(html);
      return `@@MATH${placeholders.length - 1}@@`;
    })
    .replace(/\$([^\n$]+?)\$/g, (_m, expr: string) => {
      let html: string;
      try {
        html = katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
      } catch {
        html = `<code>${escapeHtml('$' + expr + '$')}</code>`;
      }
      placeholders.push(html);
      return `@@MATH${placeholders.length - 1}@@`;
    });

  let html = marked.parse(withPlaceholders, { async: false }) as string;
  html = html.replace(/@@MATH(\d+)@@/g, (_m, i) => placeholders[parseInt(i, 10)] ?? '');
  return html;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripMarkdown(s: string): string {
  return s.replace(/\$\$[\s\S]+?\$\$/g, '').replace(/\$[^\n$]+?\$/g, '').replace(/[*_`#>[\]()]/g, '');
}
