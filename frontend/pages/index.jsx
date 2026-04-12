import { useEffect, useState } from 'react';
import Head from 'next/head';
import { CheckCircle2, CircleAlert, LockKeyhole } from 'lucide-react';
import { apiCall } from '../lib/api';
import {
  getToken,
  clearToken,
  normalizeUserPayload,
  silentRefresh,
  tokenSecondsRemaining,
} from '../lib/auth';
import { captureReferralFromLocation } from '../lib/referral';
import AppShell from '../components/layout/AppShell';
import LandingPage from '../components/layout/LandingPage';
import Dashboard from '../components/layout/Dashboard';
import AuthPage, {
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from '../components/auth/AuthPage';
import PaymentPage from '../components/auth/PaymentPage';
import CreateAlbum from '../components/album/CreateAlbum';
import AlbumSettings from '../components/album/AlbumSettings';
import QRPage from '../components/album/QRPage';
import PlaquePage from '../components/album/PlaquePage';
import AnalyticsPage from '../components/album/AnalyticsPage';
import LifeEventsPage from '../components/album/LifeEventsPage';
import PublicView from '../components/album/PublicView';
import InvoicesPage from '../components/account/InvoicesPage';
import AccountPage from '../components/account/AccountPage';
import AffiliatePage from '../components/account/AffiliatePage';
import ChatWidget from '../components/shared/ChatWidget';
import { Button } from '@/components/ui/button';

function RequireSubscription({ user, setPage, children }) {
  const hasActive =
    user?.isDemo ||
    user?.hasMemorial ||
    user?.hasWedding ||
    ['active', 'trialing', 'lifetime'].includes(user?.subscriptionStatus);

  if (!hasActive) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LockKeyhole className="size-7" />
        </div>
        <h2 className="font-display text-4xl leading-none tracking-tight text-foreground">
          Subscription Required
        </h2>
        <p className="max-w-md text-sm leading-7 text-muted-foreground">
          Choose a plan to create and manage your memorial or wedding albums.
        </p>
        <Button onClick={() => setPage('payment')} type="button">
          View Plans
        </Button>
      </div>
    );
  }

  return children;
}

function Shell({ user, setUser, setPage, page, showToast, setCurrentAlbum, children }) {
  return (
    <AppShell
      page={page}
      setCurrentAlbum={setCurrentAlbum}
      setPage={setPage}
      setUser={setUser}
      showToast={showToast}
      user={user}
    >
      <RequireSubscription setPage={setPage} user={user}>
        {children}
      </RequireSubscription>
    </AppShell>
  );
}

function Toast({ message, type = 'success' }) {
  const Icon = type === 'success' ? CheckCircle2 : CircleAlert;

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-3 text-sm text-white shadow-velvet ${
        type === 'success' ? 'bg-[#1f1a16]' : 'bg-red-600'
      }`}
      role="alert"
    >
      <Icon className="size-4" />
      {message}
    </div>
  );
}

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState('home');
  const [user, setUser] = useState(null);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    captureReferralFromLocation();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const DAY_SEC = 24 * 60 * 60;
    const secsLeft = tokenSecondsRemaining(token);
    const refreshPromise =
      secsLeft < DAY_SEC
        ? silentRefresh(
            typeof window !== 'undefined'
              ? process.env.NEXT_PUBLIC_API_URL || 'https://api.hriatrengna.in'
              : ''
          )
        : Promise.resolve(token);

    refreshPromise
      .then((activeToken) => {
        if (!activeToken) {
          showToast('Session expired. Please sign in again.', 'error');
          return;
        }
        return apiCall('/api/auth/me', {}, activeToken);
      })
      .then((data) => {
        if (!data) return;
        const nextUser = normalizeUserPayload(data.user);
        setUser(nextUser);
        const pending =
          typeof window !== 'undefined' ? sessionStorage.getItem('mqr_post_login_page') : null;

        if (pending) {
          setPage(pending);
          sessionStorage.removeItem('mqr_post_login_page');
        } else if (
          nextUser?.hasMemorial ||
          nextUser?.hasWedding ||
          ['active', 'trialing', 'lifetime'].includes(nextUser?.subscriptionStatus)
        ) {
          setPage('dashboard');
        }
      })
      .catch(() => {
        clearToken();
        showToast('Session expired. Please sign in again.', 'error');
      });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path === '/verify-email') setPage('verify-email');
    if (path === '/reset-password') setPage('reset-password');
  }, []);

  if (!mounted) return null;

  const album = { currentAlbum, setCurrentAlbum, setPage, showToast };
  const pageTitleMap = {
    home: 'Hriatrengna - Digital Albums for Memorials, Weddings, and Studios',
    login: 'Sign In - Hriatrengna',
    signup: 'Create Account - Hriatrengna',
    'trial-signup': 'Start Free Trial - Hriatrengna',
    'forgot-password': 'Forgot Password - Hriatrengna',
    'reset-password': 'Reset Password - Hriatrengna',
    'verify-email': 'Verify Email - Hriatrengna',
    payment: 'Plans and Billing - Hriatrengna',
    dashboard: 'Dashboard - Hriatrengna',
    create: 'Create Album - Hriatrengna',
    settings: 'Album Settings - Hriatrengna',
    analytics: 'Album Analytics - Hriatrengna',
    'life-events': 'Life Events - Hriatrengna',
    plaque: 'QR Plaque - Hriatrengna',
    invoices: 'Invoices - Hriatrengna',
    account: 'Account - Hriatrengna',
    affiliate: 'Affiliate - Hriatrengna',
    'public-view': 'Album Preview - Hriatrengna',
    qr: 'QR Code - Hriatrengna',
  };

  return (
    <>
      <Head>
        <title>{pageTitleMap[page] || 'Hriatrengna'}</title>
      </Head>
      {toast && <Toast message={toast.message} type={toast.type} />}

      {page === 'home' && <LandingPage onLogin={() => setPage('login')} onSignup={() => setPage('signup')} />}
      {page === 'login' && <AuthPage mode="login" setPage={setPage} setUser={setUser} />}
      {page === 'signup' && <AuthPage mode="signup" setPage={setPage} setUser={setUser} />}
      {page === 'trial-signup' && (
        <AuthPage
          initialSignupMode="trial"
          mode="signup"
          setPage={setPage}
          setUser={setUser}
        />
      )}
      {page === 'forgot-password' && <ForgotPasswordPage setPage={setPage} />}
      {page === 'reset-password' && <ResetPasswordPage setPage={setPage} />}
      {page === 'verify-email' && <VerifyEmailPage setPage={setPage} />}

      {page === 'payment' &&
        (user ? (
          <AppShell
            page={page}
            setPage={setPage}
            setUser={setUser}
            showToast={showToast}
            user={user}
          >
            <PaymentPage setPage={setPage} setUser={setUser} user={user} />
          </AppShell>
        ) : (
          <PaymentPage setPage={setPage} setUser={setUser} user={user} />
        ))}

      {page === 'dashboard' && (
        <Shell
          page={page}
          setCurrentAlbum={setCurrentAlbum}
          setPage={setPage}
          setUser={setUser}
          showToast={showToast}
          user={user}
        >
          <Dashboard
            setCurrentAlbum={setCurrentAlbum}
            setPage={setPage}
            setUser={setUser}
            showToast={showToast}
            user={user}
          />
        </Shell>
      )}
      {page === 'create' && (
        <Shell
          page={page}
          setCurrentAlbum={setCurrentAlbum}
          setPage={setPage}
          setUser={setUser}
          showToast={showToast}
          user={user}
        >
          <CreateAlbum user={user} {...album} />
        </Shell>
      )}
      {page === 'settings' && (
        <Shell
          page={page}
          setCurrentAlbum={setCurrentAlbum}
          setPage={setPage}
          setUser={setUser}
          showToast={showToast}
          user={user}
        >
          <AlbumSettings user={user} {...album} />
        </Shell>
      )}
      {page === 'analytics' && (
        <Shell
          page={page}
          setCurrentAlbum={setCurrentAlbum}
          setPage={setPage}
          setUser={setUser}
          showToast={showToast}
          user={user}
        >
          <AnalyticsPage {...album} />
        </Shell>
      )}
      {page === 'life-events' && (
        <Shell
          page={page}
          setCurrentAlbum={setCurrentAlbum}
          setPage={setPage}
          setUser={setUser}
          showToast={showToast}
          user={user}
        >
          <LifeEventsPage {...album} />
        </Shell>
      )}
      {page === 'plaque' && (
        <Shell
          page={page}
          setCurrentAlbum={setCurrentAlbum}
          setPage={setPage}
          setUser={setUser}
          showToast={showToast}
          user={user}
        >
          <PlaquePage user={user} {...album} />
        </Shell>
      )}
      {page === 'invoices' && (
        <Shell
          page={page}
          setCurrentAlbum={setCurrentAlbum}
          setPage={setPage}
          setUser={setUser}
          showToast={showToast}
          user={user}
        >
          <InvoicesPage setPage={setPage} />
        </Shell>
      )}
      {page === 'account' && (
        <Shell
          page={page}
          setCurrentAlbum={setCurrentAlbum}
          setPage={setPage}
          setUser={setUser}
          showToast={showToast}
          user={user}
        >
          <AccountPage setPage={setPage} setUser={setUser} showToast={showToast} user={user} />
        </Shell>
      )}
      {page === 'affiliate' && (
        <Shell
          page={page}
          setCurrentAlbum={setCurrentAlbum}
          setPage={setPage}
          setUser={setUser}
          showToast={showToast}
          user={user}
        >
          <AffiliatePage user={user} />
        </Shell>
      )}
      {page === 'public-view' && (
        <Shell
          page={page}
          setCurrentAlbum={setCurrentAlbum}
          setPage={setPage}
          setUser={setUser}
          showToast={showToast}
          user={user}
        >
          <PublicView currentAlbum={currentAlbum} setPage={setPage} />
        </Shell>
      )}
      {page === 'qr' && <QRPage currentAlbum={currentAlbum} setPage={setPage} user={user} />}

      {(user || page === 'home') && <ChatWidget user={user} />}
    </>
  );
}
