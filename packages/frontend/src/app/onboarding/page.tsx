'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// No plan chooser in the translator-only SaaS — go straight to the dashboard,
// which is self-explanatory (no separate onboarding wizard).
export default function OnboardingRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard'); }, [router]);
  return null;
}
