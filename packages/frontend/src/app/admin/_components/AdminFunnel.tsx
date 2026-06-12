'use client';
import type { FunnelData } from '../_lib/types';

interface Stage {
  key: keyof FunnelData;
  label: string;
}

const STAGES: Stage[] = [
  { key: 'signed_up', label: 'Signed up' },
  { key: 'claimed_bonus', label: 'Claimed $2 gift' },
  { key: 'first_call', label: 'Made first call' },
  { key: 'first_topup', label: 'First top-up' },
];

export default function AdminFunnel({ funnel }: { funnel: FunnelData }) {
  const cohort = funnel.signed_up;

  return (
    <div
      className="rounded-xl p-4 md:p-5"
      style={{
        background: 'var(--th-card)',
        border: '1px solid var(--th-card-border-subtle)',
        boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
      }}
    >
      <h3 className="text-[10px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
        Activation funnel — signups in this period
      </h3>

      {cohort === 0 ? (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--th-text-muted)' }}>
          No signups in this period
        </p>
      ) : (
        <div className="space-y-2.5">
          {STAGES.map((stage, i) => {
            const value = funnel[stage.key];
            const pctOfCohort = cohort > 0 ? (value / cohort) * 100 : 0;
            const prev = i > 0 ? funnel[STAGES[i - 1].key] : null;
            const pctOfPrev = prev != null && prev > 0 ? (value / prev) * 100 : null;
            return (
              <div key={stage.key}>
                <div className="flex justify-between items-baseline text-xs mb-1">
                  <span style={{ color: 'var(--th-text)' }}>{stage.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-headline text-sm" style={{ color: 'var(--th-text)' }}>{value}</span>
                    <span style={{ color: 'var(--th-text-muted)' }}>
                      {pctOfCohort.toFixed(0)}%
                      {i > 0 && pctOfPrev != null && (
                        <span className="ml-1.5">({pctOfPrev.toFixed(0)}% of prev)</span>
                      )}
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--th-surface)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(pctOfCohort, value > 0 ? 2 : 0)}%`,
                      background: `linear-gradient(90deg, var(--th-primary), rgba(139,92,246,0.7))`,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Detached optional stage */}
          <div className="pt-2 mt-1 flex justify-between items-baseline text-xs" style={{ borderTop: '1px dashed var(--th-border)' }}>
            <span style={{ color: 'var(--th-text-secondary)' }}>Bought a personal number</span>
            <span className="flex items-baseline gap-2">
              <span className="font-headline text-sm" style={{ color: 'var(--th-text)' }}>{funnel.bought_number}</span>
              <span style={{ color: 'var(--th-text-muted)' }}>{cohort > 0 ? ((funnel.bought_number / cohort) * 100).toFixed(0) : 0}%</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
