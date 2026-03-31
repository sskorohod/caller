'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '◉' },
  { href: '/dashboard/calls', label: 'Calls', icon: '☎' },
  { href: '/dashboard/agents', label: 'Agents', icon: '⚙' },
  { href: '/dashboard/knowledge', label: 'Knowledge', icon: '📄' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚡' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center border-b border-gray-200 px-5">
        <span className="text-lg font-bold tracking-tight">Caller</span>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
