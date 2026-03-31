'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Root() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading) router.replace(token ? '/dashboard' : '/login');
  }, [token, isLoading, router]);
  return null;
}
