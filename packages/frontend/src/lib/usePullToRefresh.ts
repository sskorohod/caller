'use client';
import { useRef, useState, useCallback, useEffect } from 'react';

const DEFAULT_PULL_THRESHOLD = 80;

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

/** Find the nearest scrollable ancestor (the element that actually scrolls) */
function getScrollParent(el: HTMLElement): HTMLElement {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflow + style.overflowY)) return node;
    node = node.parentElement;
  }
  return document.documentElement;
}

export function usePullToRefresh({ onRefresh, threshold = DEFAULT_PULL_THRESHOLD }: PullToRefreshOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);
  const scrollParent = useRef<HTMLElement | null>(null);

  // Resolve scroll parent once on mount
  useEffect(() => {
    if (ref.current) {
      scrollParent.current = getScrollParent(ref.current);
    }
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const sp = scrollParent.current;
    if (!sp || isRefreshing) return;
    // Only allow pull-to-refresh when scroll container is at the very top
    if (sp.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      // Double-check scroll parent is still at top (could have scrolled between start and move)
      const sp = scrollParent.current;
      if (sp && sp.scrollTop > 0) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }
      e.preventDefault();
      setPullDistance(Math.min(dy * 0.5, threshold * 1.5));
    } else {
      // User is scrolling up (finger moved up) — cancel pull and let native scroll handle it
      pulling.current = false;
      setPullDistance(0);
    }
  }, [threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try { await onRefresh(); } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { ref, isRefreshing, pullDistance };
}
