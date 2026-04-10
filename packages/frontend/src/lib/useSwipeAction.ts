'use client';
import { useRef, useState, useCallback } from 'react';
import type { TouchEvent as ReactTouchEvent, CSSProperties } from 'react';

interface SwipeActionOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  maxSwipe?: number;
}

export function useSwipeAction({
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
  maxSwipe = 120,
}: SwipeActionOptions = {}) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);
  const locked = useRef(false);

  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = false;
    locked.current = false;
  }, []);

  const onTouchMove = useCallback((e: ReactTouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!locked.current) {
      if (Math.abs(dy) > Math.abs(dx)) {
        locked.current = true;
        return;
      }
      if (Math.abs(dx) > 10) {
        swiping.current = true;
        locked.current = true;
      }
    }

    if (!swiping.current) return;

    const clamped = Math.max(-maxSwipe, Math.min(maxSwipe, dx));
    if ((clamped < 0 && onSwipeLeft) || (clamped > 0 && onSwipeRight)) {
      setOffsetX(clamped);
    }
  }, [maxSwipe, onSwipeLeft, onSwipeRight]);

  const onTouchEnd = useCallback(() => {
    if (offsetX <= -threshold && onSwipeLeft) onSwipeLeft();
    else if (offsetX >= threshold && onSwipeRight) onSwipeRight();
    setOffsetX(0);
    swiping.current = false;
  }, [offsetX, threshold, onSwipeLeft, onSwipeRight]);

  const style: CSSProperties = {
    transform: `translateX(${offsetX}px)`,
    transition: offsetX === 0 ? 'transform 0.25s cubic-bezier(0.2,0,0,1)' : 'none',
  };

  return { style, handlers: { onTouchStart, onTouchMove, onTouchEnd }, offsetX };
}
