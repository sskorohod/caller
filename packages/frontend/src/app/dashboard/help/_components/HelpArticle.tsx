'use client';
import { useMemo } from 'react';

interface Props {
  content: string;
  accentColor?: string;
}

/**
 * Professional markdown renderer for help articles.
 * Supports: headings, bold, code, code blocks, lists, blockquotes, tables, links.
 */
export function HelpArticle({ content, accentColor = '#6366f1' }: Props) {
  const html = useMemo(() => renderMarkdown(content, accentColor), [content, accentColor]);

  return (
    <div
      className="help-article"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMarkdown(md: string, accent: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inCodeBlock = false;
  let inTable = false;
  let inList = false;
  let listType: 'ul' | 'ol' = 'ul';
  let inBlockquote = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p style="color:var(--th-text-muted);font-size:14px;line-height:1.7;margin-bottom:12px">${paragraph.join(' ')}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (inList) { out.push('</div>'); inList = false; }
  };

  const flushBlockquote = () => {
    if (inBlockquote) { out.push('</div></div>'); inBlockquote = false; }
  };

  const flushTable = () => {
    if (inTable) { out.push('</tbody></table></div></div>'); inTable = false; }
  };

  const inline = (text: string): string => {
    return text
      .replace(/`([^`]+)`/g, `<code style="padding:2px 6px;border-radius:6px;background:var(--th-card-hover);color:${accent};font-size:12px;font-family:ui-monospace,monospace;font-weight:500">$1</code>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--th-text);font-weight:600">$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener" style="color:${accent};text-decoration:none;font-weight:500;border-bottom:1px solid ${accent}40">$1</a>`);
  };

  for (const rawLine of lines) {
    const line = rawLine;

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        out.push('</code></pre></div>');
        inCodeBlock = false;
      } else {
        flushParagraph(); flushList(); flushBlockquote(); flushTable();
        out.push(`<div style="margin-bottom:16px;border-radius:12px;overflow:hidden;border:1px solid var(--th-card-border-subtle)"><div style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--th-surface);border-bottom:1px solid var(--th-card-border-subtle)"><span style="width:6px;height:6px;border-radius:50%;background:#ef4444;opacity:0.6"></span><span style="width:6px;height:6px;border-radius:50%;background:#eab308;opacity:0.6"></span><span style="width:6px;height:6px;border-radius:50%;background:#22c55e;opacity:0.6"></span><span style="margin-left:8px;font-size:10px;color:var(--th-text-muted);font-family:ui-monospace,monospace">code</span></div><pre style="padding:16px;margin:0;overflow-x:auto;background:var(--th-card-hover)"><code style="font-size:12px;line-height:1.6;font-family:ui-monospace,monospace;color:var(--th-text-muted)">`);
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
      flushParagraph(); flushList(); flushBlockquote(); flushTable();
      continue;
    }

    // Headings
    const h1 = line.match(/^# (.+)$/);
    if (h1) {
      flushParagraph(); flushList(); flushBlockquote(); flushTable();
      out.push(`<h1 style="font-size:20px;font-weight:700;color:var(--th-text);margin-bottom:12px;margin-top:4px;display:flex;align-items:center;gap:8px">${inline(h1[1])}</h1>`);
      continue;
    }
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      flushParagraph(); flushList(); flushBlockquote(); flushTable();
      out.push(`<div style="margin-top:28px;margin-bottom:12px;display:flex;align-items:center;gap:8px"><div style="width:3px;height:18px;border-radius:2px;background:${accent}"></div><h2 style="font-size:15px;font-weight:700;color:var(--th-text);margin:0">${inline(h2[1])}</h2></div>`);
      continue;
    }
    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      flushParagraph(); flushList(); flushBlockquote(); flushTable();
      out.push(`<h3 style="font-size:13px;font-weight:700;color:var(--th-text);margin-top:20px;margin-bottom:8px">${inline(h3[1])}</h3>`);
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('> ')) {
      flushParagraph(); flushList(); flushTable();
      if (!inBlockquote) {
        out.push(`<div style="margin-bottom:16px;border-radius:12px;border:1px solid ${accent}20;background:${accent}08;padding:12px 16px;display:flex;gap:10px"><div style="flex-shrink:0;margin-top:2px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg></div><div>`);
        inBlockquote = true;
      }
      out.push(`<p style="font-size:13px;color:var(--th-text-muted);line-height:1.6;margin:0">${inline(line.trim().slice(2))}</p>`);
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    // Table
    if (line.trim().startsWith('|')) {
      flushParagraph(); flushList(); flushBlockquote();
      const cells = line.trim().split('|').filter(c => c.trim() !== '');

      if (cells.every(c => /^[\s-:]+$/.test(c))) continue;

      if (!inTable) {
        out.push(`<div style="margin-bottom:16px;border-radius:12px;border:1px solid var(--th-card-border-subtle);overflow:hidden"><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">`);
        out.push('<thead><tr>');
        for (const cell of cells) {
          out.push(`<th style="text-align:left;padding:10px 14px;font-size:11px;font-weight:600;color:var(--th-text);text-transform:uppercase;letter-spacing:0.05em;background:var(--th-surface);border-bottom:1px solid var(--th-card-border-subtle)">${inline(cell.trim())}</th>`);
        }
        out.push('</tr></thead><tbody>');
        inTable = true;
      } else {
        out.push('<tr>');
        for (const cell of cells) {
          out.push(`<td style="padding:10px 14px;font-size:13px;color:var(--th-text-muted);border-bottom:1px solid var(--th-card-border-subtle)">${inline(cell.trim())}</td>`);
        }
        out.push('</tr>');
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Unordered list
    if (line.trim().match(/^[-*] /)) {
      flushParagraph(); flushBlockquote(); flushTable();
      if (!inList || listType !== 'ul') {
        if (inList) flushList();
        out.push('<div style="margin-bottom:12px;display:flex;flex-direction:column;gap:6px;margin-left:4px">');
        inList = true;
        listType = 'ul';
      }
      const text = line.trim().replace(/^[-*] /, '');
      out.push(`<div style="display:flex;align-items:flex-start;gap:10px;font-size:14px;color:var(--th-text-muted);line-height:1.6"><span style="width:6px;height:6px;border-radius:50%;background:${accent};margin-top:8px;flex-shrink:0;opacity:0.7"></span><span>${inline(text)}</span></div>`);
      continue;
    }

    // Ordered list
    if (line.trim().match(/^\d+\. /)) {
      flushParagraph(); flushBlockquote(); flushTable();
      if (!inList || listType !== 'ol') {
        if (inList) flushList();
        out.push('<div style="margin-bottom:12px;display:flex;flex-direction:column;gap:8px;margin-left:4px">');
        inList = true;
        listType = 'ol';
      }
      const match = line.trim().match(/^(\d+)\. (.+)$/);
      if (match) {
        out.push(`<div style="display:flex;align-items:flex-start;gap:10px;font-size:14px;color:var(--th-text-muted);line-height:1.6"><span style="width:22px;height:22px;border-radius:50%;background:${accent}12;color:${accent};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;margin-top:1px">${match[1]}</span><span>${inline(match[2])}</span></div>`);
      }
      continue;
    }

    // Paragraph
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
