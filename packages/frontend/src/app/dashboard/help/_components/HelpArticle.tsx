'use client';
import { useMemo } from 'react';

interface Props {
  content: string; // markdown-like content
}

/**
 * Simple markdown renderer for help articles.
 * Supports: # headings, ## headings, ### headings, **bold**, `code`, ```code blocks```,
 * - lists, > blockquotes, | tables, [links](url), empty lines as paragraph breaks.
 */
export function HelpArticle({ content }: Props) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className="help-article prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inCodeBlock = false;
  let inTable = false;
  let inList = false;
  let inBlockquote = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p class="text-sm leading-relaxed text-[var(--th-text-muted)] mb-3">${paragraph.join(' ')}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  const flushBlockquote = () => {
    if (inBlockquote) {
      out.push('</div>');
      inBlockquote = false;
    }
  };

  const flushTable = () => {
    if (inTable) {
      out.push('</tbody></table></div>');
      inTable = false;
    }
  };

  const inline = (text: string): string => {
    return text
      // code
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-[var(--th-card-hover)] text-[var(--th-primary-light)] text-xs font-mono">$1</code>')
      // bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[var(--th-text)] font-semibold">$1</strong>')
      // links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-[var(--th-primary-light)] hover:underline">$1</a>');
  };

  for (const rawLine of lines) {
    const line = rawLine;

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        out.push('</code></pre>');
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        flushBlockquote();
        flushTable();
        out.push('<pre class="rounded-xl bg-[var(--th-card-hover)] p-4 mb-3 overflow-x-auto"><code class="text-xs font-mono text-[var(--th-text-muted)]">');
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      out.push(escapeHtml(line) + '\n');
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      flushBlockquote();
      flushTable();
      continue;
    }

    // Headings
    const h1 = line.match(/^# (.+)$/);
    if (h1) {
      flushParagraph(); flushList(); flushBlockquote(); flushTable();
      out.push(`<h1 class="text-xl font-bold text-[var(--th-text)] mb-3 mt-1">${inline(h1[1])}</h1>`);
      continue;
    }
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      flushParagraph(); flushList(); flushBlockquote(); flushTable();
      out.push(`<h2 class="text-base font-bold text-[var(--th-text)] mb-2 mt-5">${inline(h2[1])}</h2>`);
      continue;
    }
    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      flushParagraph(); flushList(); flushBlockquote(); flushTable();
      out.push(`<h3 class="text-sm font-bold text-[var(--th-text)] mb-2 mt-4">${inline(h3[1])}</h3>`);
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('> ')) {
      flushParagraph(); flushList(); flushTable();
      if (!inBlockquote) {
        out.push('<div class="border-l-2 border-[var(--th-primary)] pl-4 py-2 mb-3 rounded-r-lg bg-[var(--th-primary)]/5">');
        inBlockquote = true;
      }
      out.push(`<p class="text-sm text-[var(--th-text-muted)]">${inline(line.trim().slice(2))}</p>`);
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    // Table
    if (line.trim().startsWith('|')) {
      flushParagraph(); flushList(); flushBlockquote();
      const cells = line.trim().split('|').filter(c => c.trim() !== '');

      // Skip separator row
      if (cells.every(c => /^[\s-:]+$/.test(c))) continue;

      if (!inTable) {
        out.push('<div class="overflow-x-auto mb-3"><table class="w-full text-sm border-collapse">');
        // First row = header
        out.push('<thead><tr>');
        for (const cell of cells) {
          out.push(`<th class="text-left px-3 py-2 text-[var(--th-text)] font-semibold border-b border-[var(--th-card-border-subtle)] text-xs">${inline(cell.trim())}</th>`);
        }
        out.push('</tr></thead><tbody>');
        inTable = true;
      } else {
        out.push('<tr>');
        for (const cell of cells) {
          out.push(`<td class="px-3 py-2 text-[var(--th-text-muted)] border-b border-[var(--th-card-border-subtle)] text-xs">${inline(cell.trim())}</td>`);
        }
        out.push('</tr>');
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // List items
    if (line.trim().match(/^[-*] /)) {
      flushParagraph(); flushBlockquote(); flushTable();
      if (!inList) {
        out.push('<ul class="space-y-1.5 mb-3 ml-1">');
        inList = true;
      }
      const text = line.trim().replace(/^[-*] /, '');
      out.push(`<li class="flex items-start gap-2 text-sm text-[var(--th-text-muted)]"><span class="w-1.5 h-1.5 rounded-full bg-[var(--th-primary)] mt-2 shrink-0"></span><span>${inline(text)}</span></li>`);
      continue;
    }

    // Ordered list
    if (line.trim().match(/^\d+\. /)) {
      flushParagraph(); flushBlockquote(); flushTable();
      if (!inList) {
        out.push('<ul class="space-y-1.5 mb-3 ml-1">');
        inList = true;
      }
      const match = line.trim().match(/^(\d+)\. (.+)$/);
      if (match) {
        out.push(`<li class="flex items-start gap-2 text-sm text-[var(--th-text-muted)]"><span class="w-5 h-5 rounded-full bg-[var(--th-primary)]/10 text-[var(--th-primary-light)] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">${match[1]}</span><span>${inline(match[2])}</span></li>`);
      }
      continue;
    }

    // Otherwise: paragraph text
    if (inList) flushList();
    paragraph.push(inline(line.trim()));
  }

  flushParagraph();
  flushList();
  flushBlockquote();
  flushTable();

  return out.join('\n');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
