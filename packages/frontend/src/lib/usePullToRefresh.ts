'use client';
import { useRef, useState, useCallback, useEffect } from 'react';

const DEFAULT_PULL_THRESHOLD = 80;

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

/**
 * Pull-to-refresh hook.
 *
 * Key design: we ONLY add a non-passive touchmove listener when a pull gesture
 * is actually happening (scroll container at top + finger moving down). This
 * avoids blocking native scrolling at all other times.
 */
export function usePullToRefresh({ onRefresh, threshold = DEFAULT_PULL_THRESHOLD }: PullToRefreshOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  // Mutable refs to avoid stale closures in event handlers
  const startY = useRef(0);
  const isPulling = useRef(false);
  const refreshingRef = useRef(false);
  const pullDistRef = useRef(0);
  const thresholdRef = useRef(threshold);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  useEffect(() => { refreshingRef.current = isRefreshing; }, [isRefreshing]);

  /** Find the nearest scrollable ancestor */
  const getScrollTop = useCallback(() => {
    let node: HTMLElement | null = ref.current?.parentElement ?? null;
    while (node) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflow + style.overflowY)) {
        return node.scrollTop;
      }
      node = node.parentElement;
    }
    return window.scrollY;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Non-passive move handler — only added dynamically during pull
    const handlePullMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && getScrollTop() <= 0) {
        e.preventDefault();
        const dist = Math.min(dy * 0.5, thresholdRef.current * 1.5);
        pullDistRef.current = dist;
        setPullDistance(dist);
      } else {
        // Finger went up or page scrolled — abort pull, remove handler
        cancelPull();
      }
    };

    const handlePullEnd = () => {
      const dist = pullDistRef.current;
      cancelPull();
      if (dist >= thresholdRef.current) {
        setIsRefreshing(true);
        refreshingRef.current = true;
        onRefreshRef.current().finally(() => {
          setIsRefreshing(false);
          refreshingRef.current = false;
        });
      }
    };

    const cancelPull = () => {
      if (!isPulling.current) return;
      isPulling.current = false;
      pullDistRef.current = 0;
      setPullDistance(0);
      el.removeEventListener('touchmove', handlePullMove);
      el.removeEventListener('touchend', handlePullEnd);
      el.removeEventListener('touchcancel', handlePullEnd);
    };

    // Passive touchstart — just records start position, never blocks scroll
    const handleTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current || isPulling.current) return;
      // Only if scroll container is at the very top
      if (getScrollTop() > 0) return;
      startY.current = e.touches[0].clientY;

      // Defer adding non-passive listeners — they're added now but will only
      // preventDefault if we confirm it's a pull-down gesture
      isPulling.current = true;
      el.addEventListener('touchmove', handlePullMove, { passive: false });
      el.addEventListener('touchend', handlePullEnd);
      el.addEventListener('touchcancel', handlePullEnd);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      // Cleanup in case component unmounts mid-pull
      el.removeEventListener('touchmove', handlePullMove);
      el.removeEventListener('touchend', handlePullEnd);
      el.removeEventListener('touchcancel', handlePullEnd);
    };
  }, [getScrollTop]);

  return { ref, isRefreshing, pullDistance };
}
