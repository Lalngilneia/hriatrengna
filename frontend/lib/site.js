export const PUBLIC_SITE = {
  companyName: 'Hriatrengna',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@hriatrengna.in',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://hriatrengna.in',
  location: 'Aizawl, Mizoram, India',
  effectiveDate: '1 July 2025',
  supportResponseWindow: '3 business days',
};

export const PUBLIC_LEGAL_LINKS = [
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Refund Policy', href: '/refund' },
];
