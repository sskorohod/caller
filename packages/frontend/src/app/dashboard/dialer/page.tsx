'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Dialer is temporarily hidden in the translator-only SaaS. Redirect to Home.
export default function DialerRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard'); }, [router]);
  return null;
}
