export const navSections = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', icon: 'dashboard', label: 'Dashboard' },
      { href: '/admin/analytics', icon: 'insights', label: 'Analytics' },
    ],
  },
  {
    label: 'Translator',
    items: [
      { href: '/admin/workspaces', icon: 'person', label: 'Subscribers' },
      { href: '/admin/sessions', icon: 'history', label: 'Sessions' },
      { href: '/admin/finance', icon: 'monitoring', label: 'Finance' },
      { href: '/admin/numbers', icon: 'sim_card', label: 'Numbers' },
      { href: '/admin/promo', icon: 'confirmation_number', label: 'Promo Codes' },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/admin/tickets', icon: 'support_agent', label: 'Support Tickets' },
      { href: '/admin/contacts', icon: 'mail', label: 'Contact Messages' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { href: '/admin/providers', icon: 'hub', label: 'Providers' },
      { href: '/admin/settings', icon: 'settings', label: 'Settings' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/audit', icon: 'shield', label: 'Audit Log' },
    ],
  },
];

export const adminBottomTabs = [
  { key: 'Dashboard', href: '/admin', icon: 'dashboard' },
  { key: 'Subscribers', href: '/admin/workspaces', icon: 'person' },
  { key: 'Finance', href: '/admin/finance', icon: 'monitoring' },
  { key: 'Sessions', href: '/admin/sessions', icon: 'history' },
];

export const adminMoreSections = [
  {
    label: 'Translator',
    items: [
      { href: '/admin/numbers', icon: 'sim_card', label: 'Numbers' },
      { href: '/admin/promo', icon: 'confirmation_number', label: 'Promo Codes' },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/admin/tickets', icon: 'support_agent', label: 'Support Tickets' },
      { href: '/admin/contacts', icon: 'mail', label: 'Contact Messages' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { href: '/admin/providers', icon: 'hub', label: 'Providers' },
      { href: '/admin/settings', icon: 'settings', label: 'Settings' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/audit', icon: 'shield', label: 'Audit Log' },
    ],
  },
];
