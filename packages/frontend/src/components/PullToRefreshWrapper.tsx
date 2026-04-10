'use client';
import { usePullToRefresh } from '@/lib/usePullToRefresh';

interface PullToRefreshWrapperProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefreshWrapper({ onRefresh, children }: PullToRefreshWrapperProps) {
  const { ref, isRefreshing, pullDistance } = usePullToRefresh({ onRefresh });
  const progress = Math.min(pullDistance / 80, 1);
  const indicatorHeight = isRefreshing ? 56 : pullDistance * 0.5;

  return (
    <div ref={ref} className="relative min-h-full">
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex flex-col items-center justify-center overflow-hidden"
          style={{
            height: indicatorHeight,
            transition: isRefreshing ? 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          }}
        >
          <div
            className="relative w-8 h-8 flex items-center justify-center"
            style={{
              opacity: isRefreshing ? 1 : Math.min(progress * 1.5, 1),
              transform: `scale(${isRefreshing ? 1 : 0.5 + progress * 0.5})`,
              transition: isRefreshing ? 'transform 0.3s ease' : 'none',
            }}
          >
            {/* Circular progress / spinner */}
            <svg className="w-7 h-7" viewBox="0 0 28 28">
              <circle
                cx="14" cy="14" r="11"
                fill="none"
                stroke="var(--th-border)"
                strokeWidth="2.5"
              />
              <circle
                cx="14" cy="14" r="11"
                fill="none"
                stroke="var(--th-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={69.1}
                strokeDashoffset={isRefreshing ? 17 : 69.1 - (69.1 * progress)}
                style={{
                  transform: isRefreshing ? undefined : `rotate(${pullDistance * 4}deg)`,
                  transformOrigin: 'center',
                  animation: isRefreshing ? 'ptr-spin 0.8s linear infinite' : 'none',
                }}
              />
            </svg>
          </div>
          {!isRefreshing && progress >= 1 && (
            <span
              className="text-[10px] font-medium mt-0.5"
              style={{ color: 'var(--th-primary)', animation: 'fadeIn 0.2s ease' }}
            >
              Release to refresh
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
