/**
 * components/layout/AppShell.jsx
 * Authenticated subscriber shell.
 */

import { useState } from 'react';
import { planName } from '../../lib/constants';
import { clearToken } from '../../lib/auth';

const NAV_ITEMS = [
  { id: 'dashboard', icon: 'DB', label: 'Dashboard' },
  { id: 'create', icon: 'NA', label: 'New Album' },
  { id: 'life-events', icon: 'LE', label: 'Life Events' },
  { id: 'analytics', icon: 'AN', label: 'Analytics' },
  { id: 'plaque', icon: 'QR', label: 'QR Plaque' },
];

const BOTTOM_ITEMS = [
  { id: 'account', icon: 'AC', label: 'Account & Billing' },
  { id: 'invoices', icon: 'IV', label: 'Invoices' },
  { id: 'payment', icon: 'PL', label: 'Add Subscription', badge: 'NEW' },
];

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  create: 'New Album',
  settings: 'Album Settings',
  plaque: 'QR Plaque Designer',
  analytics: 'Analytics',
  'life-events': 'Life Events',
  invoices: 'Invoices',
  account: 'Account & Billing',
  payment: 'Subscription',
  'public-view': 'Preview',
  qr: 'QR Code',
};

export default function AppShell({ user, setPage, page, children, setCurrentAlbum }) {
  const [navOpen, setNavOpen] = useState(false);
  const title = PAGE_TITLES[page] || '';

  const navigate = (nextPage) => {
    if (nextPage === 'create' && typeof setCurrentAlbum === 'function') {
      setCurrentAlbum(null);
    }
    setPage(nextPage);
    setNavOpen(false);
  };

  const signOut = () => {
    clearToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mqr_admin_token');
      localStorage.removeItem('affiliate_token');
      localStorage.removeItem('affiliate_user');
      localStorage.removeItem('hr_pwa_token');
    }
    window.location.href = '/';
  };

  return (
    <div className="shell">
      {navOpen && (
        <button
          type="button"
          className="shell-overlay"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}

      <nav className={`shell-sidebar${navOpen ? ' open' : ''}`} aria-label="Main navigation">
        <button
          type="button"
          className="shell-logo"
          onClick={() => navigate('dashboard')}
          aria-label="Go to dashboard"
        >
          <span className="shell-logo-icon">
            <img src="/icons/icon-192.png" alt="Hriatrengna logo" />
          </span>
          <span>
            <div className="shell-logo-name">Hriatrengna</div>
            <div className="shell-logo-sub">Subscriber Workspace</div>
          </span>
        </button>

        <div className="shell-nav-scroll">
          <div className="shell-nav-section">Workspace</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`shell-nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => navigate(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
            >
              <span className="shell-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="shell-nav-label">{item.label}</span>
            </button>
          ))}

          <div className="shell-nav-section shell-nav-section-spaced">Billing</div>
          {BOTTOM_ITEMS.map((item) => {
            // Only show the 'Add Subscription' badge when the user can actually
            // add another plan type (has one but not both, or is on demo).
            const canAddMore = user?.isDemo
              || (user?.hasMemorial && !user?.hasWedding)
              || (user?.hasWedding && !user?.hasMemorial);
            const badge = item.id === 'payment' && !canAddMore ? null : item.badge;
            // Rename the payment item label based on context
            const label = item.id === 'payment'
              ? (canAddMore ? 'Add Subscription' : 'Manage Plans')
              : item.label;
            return (
              <button
                key={item.id}
                type="button"
                className={`shell-nav-item${page === item.id ? ' active' : ''}`}
                onClick={() => navigate(item.id)}
                aria-current={page === item.id ? 'page' : undefined}
              >
                <span className="shell-nav-icon" aria-hidden="true">{item.icon}</span>
                <span className="shell-nav-label">{label}</span>
                {badge ? <span className="shell-nav-badge">{badge}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="shell-user">
          <div className="shell-avatar" aria-hidden="true">
            {(user?.name || 'U')[0].toUpperCase()}
          </div>
          <div className="shell-user-copy">
            <div className="shell-user-name">{user?.name || 'Subscriber'}</div>
            <div className="shell-user-plan">{planName(user?.subscriptionPlan)}</div>
          </div>
          <button
            type="button"
            className="shell-logout"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
          >
            Out
          </button>
        </div>
      </nav>

      <div className="shell-main">
        <header className="shell-topbar">
          <div className="shell-topbar-left">
            <button
              type="button"
              className="shell-mobile-toggle"
              onClick={() => setNavOpen((open) => !open)}
              aria-label="Toggle navigation"
            >
              Menu
            </button>
            <div>
              <h1 className="shell-topbar-title">{title}</h1>
              <div className="shell-topbar-sub">Subscriber dashboard</div>
            </div>
          </div>
          <div className="shell-topbar-right">
            <div className="shell-topbar-chip">{user?.subscriptionStatus || 'active'}</div>
          </div>
        </header>

        <div className="shell-content">
          <main className="shell-page-body" id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
