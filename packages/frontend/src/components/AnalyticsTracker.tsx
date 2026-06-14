'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageview } from '@/lib/analytics';

/**
 * Mounts the first-party site tracker and reports a pageview on every route
 * change. The tracker itself self-gates to PUBLIC pages (no /dashboard, /admin),
 * so this is safe to mount globally in the root layout. Renders nothing.
 */
export default function AnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) trackPageview(pathname);
  }, [pathname]);
  return null;
}
