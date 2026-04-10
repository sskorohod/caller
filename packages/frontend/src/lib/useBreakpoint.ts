'use client';
import { useMediaQuery } from './useMediaQuery';

export function useIsMobile(): boolean {
  return !useMediaQuery('(min-width: 768px)');
}

export function useIsTablet(): boolean {
  const aboveMd = useMediaQuery('(min-width: 768px)');
  const belowLg = !useMediaQuery('(min-width: 1024px)');
  return aboveMd && belowLg;
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
