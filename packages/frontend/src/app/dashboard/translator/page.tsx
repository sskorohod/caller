'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Translator settings now live on the dashboard Home (the hub). Redirect.
export default function TranslatorRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard'); }, [router]);
  return null;
}
