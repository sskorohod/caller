'use client';
import { useSwipeAction } from '@/lib/useSwipeAction';

interface SwipeAction {
  color: string;
  icon: React.ReactNode;
  label: string;
  onAction: () => void;
}

interface MobileListItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  swipeLeft?: SwipeAction;
  swipeRight?: SwipeAction;
}

export default function MobileListItem({ children, onClick, swipeLeft, swipeRight }: MobileListItemProps) {
  const { style, handlers, offsetX } = useSwipeAction({
    onSwipeLeft: swipeLeft?.onAction,
    onSwipeRight: swipeRight?.onAction,
  });

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ background: 'var(--th-card)' }}>
      {/* Swipe backgrounds */}
      {swipeRight && offsetX > 0 && (
        <div
          className="absolute inset-y-0 left-0 flex items-center pl-5"
          style={{ background: swipeRight.color, width: Math.abs(offsetX) }}
        >
          <span className="text-white text-xs font-medium flex items-center gap-1.5">
            {swipeRight.icon} {swipeRight.label}
          </span>
        </div>
      )}
      {swipeLeft && offsetX < 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-5"
          style={{ background: swipeLeft.color, width: Math.abs(offsetX) }}
        >
          <span className="text-white text-xs font-medium flex items-center gap-1.5">
            {swipeLeft.label} {swipeLeft.icon}
          </span>
        </div>
      )}
      {/* Content */}
      <div
        className="relative card-press"
        style={{ ...style, background: 'var(--th-card)' }}
        onClick={onClick}
        {...handlers}
      >
        <div className="px-3 py-3 md:px-4 md:py-3.5">
          {children}
        </div>
      </div>
    </div>
  );
}
