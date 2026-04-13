'use client';
import { useState } from 'react';

interface FaqItem { q: string; a: string }

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: isOpen ? 'rgba(173,198,255,0.05)' : 'rgba(26,32,44,0.4)',
              border: `1px solid ${isOpen ? 'rgba(173,198,255,0.15)' : 'rgba(140,144,159,0.08)'}`,
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between p-5 text-left group"
            >
              <span className="text-sm font-bold pr-4" style={{ color: isOpen ? '#adc6ff' : '#dde2f3' }}>{faq.q}</span>
              <span
                className="material-symbols-outlined text-xl shrink-0 transition-transform duration-300"
                style={{ color: isOpen ? '#adc6ff' : 'rgba(194,198,214,0.4)', transform: isOpen ? 'rotate(180deg)' : 'none' }}
              >
                expand_more
              </span>
            </button>
            <div
              style={{
                maxHeight: isOpen ? '200px' : '0px',
                opacity: isOpen ? 1 : 0,
                transition: 'max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
                overflow: 'hidden',
              }}
            >
              <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: '#c2c6d6' }}>{faq.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
