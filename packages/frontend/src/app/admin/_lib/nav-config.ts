export const navSections = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', icon: 'dashboard', label: 'Dashboard' },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/admin/tickets', icon: 'support_agent', label: 'Support Tickets' },
      { href: '/admin/contacts', icon: 'mail', label: 'Contact Messages' },
      { href: '/admin/sessions', icon: 'history', label: 'Sessions' },
      { href: '/admin/promo', icon: 'confirmation_number', label: 'Promo Codes' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { href: '/admin/workspaces', icon: 'person', label: 'Users' },
      { href: '/admin/finance', icon: 'monitoring', label: 'Finance' },
      { href: '/admin/billing', icon: 'tune', label: 'Billing Config' },
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
  { key: 'Users', href: '/admin/workspaces', icon: 'person' },
  { key: 'Finance', href: '/admin/finance', icon: 'monitoring' },
  { key: 'Providers', href: '/admin/providers', icon: 'hub' },
];

export const adminMoreSections = [
  {
    label: 'Management',
    items: [
      { href: '/admin/tickets', icon: 'support_agent', label: 'Support Tickets' },
      { href: '/admin/contacts', icon: 'mail', label: 'Contact Messages' },
      { href: '/admin/sessions', icon: 'history', label: 'Sessions' },
      { href: '/admin/promo', icon: 'confirmation_number', label: 'Promo Codes' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { href: '/admin/billing', icon: 'tune', label: 'Billing Config' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
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
