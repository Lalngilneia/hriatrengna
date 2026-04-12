import Head from 'next/head';
import { startTransition, useEffect, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken as getFirebaseToken } from 'firebase/messaging';
import {
  Activity as ActivityIcon,
  BellRing,
  CircleAlert,
  ClipboardList,
  Home as HomeIcon,
  LoaderCircle,
  MessageSquare,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge as UiBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input as TextInput } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.hriatrengna.in';
const TABS = ['home', 'activity', 'subscribers', 'approvals', 'support', 'settings'];
const USER_STATUSES = ['active', 'inactive', 'canceled', 'expired', 'past_due', 'halted'];
const USER_PLANS = ['monthly', 'yearly', 'lifetime', 'wedding-monthly', 'wedding-yearly', 'wedding-lifetime'];
const SUPPORT_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'archived'];
const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBcbMom7cRxIHFSU5iw32DvcRf5h1E2LTk',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'hriatrengna.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hriatrengna',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '739740579978',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:739740579978:web:7213288e5ae45653ad1573',
};
let messaging = null;
if (typeof window !== 'undefined') {
  try {
    const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    messaging = getMessaging(app);
  } catch (err) {
    console.warn('[PWA] Firebase:', err.message);
  }
}

const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('hr_pwa_token') : null);
const setToken = (value) => { if (typeof window !== 'undefined') localStorage.setItem('hr_pwa_token', value); };
const clearToken = () => { if (typeof window !== 'undefined') localStorage.removeItem('hr_pwa_token'); };
const fmtMoney = (value) => `Rs ${Math.floor(Number(value || 0)).toLocaleString('en-IN')}`;
const fmtDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-';
const fmtDateTime = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const nice = (value) => String(value || '').replace(/_/g, ' ');
const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
const qs = (params) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};
const initialTab = () => {
  if (typeof window === 'undefined') return 'home';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return TABS.includes(tab) ? tab : 'home';
};
const readRoute = () => {
  if (typeof window === 'undefined') return { tab: 'home' };
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  return {
    tab: TABS.includes(tab) ? tab : 'home',
    userId: params.get('userId') || '',
    albumId: params.get('albumId') || '',
    paymentId: params.get('paymentId') || '',
    affiliateId: params.get('affiliateId') || '',
    refundId: params.get('refundId') || '',
    orderId: params.get('orderId') || '',
    ticketId: params.get('ticketId') || '',
    activityType: params.get('activityType') || '',
  };
};
const setRouteUrl = (route) => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  Object.entries(route || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  });
  window.history.replaceState({}, '', url.toString());
};
const laterError = (ms, message) => new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

async function apiCall(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : { error: await response.text() };
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function swState(reg) {
  if (!reg) return 'not-registered';
  if (reg.active) return 'active';
  if (reg.installing) return `installing:${reg.installing.state}`;
  if (reg.waiting) return `waiting:${reg.waiting.state}`;
  return 'registered';
}

async function waitForActive(reg) {
  if (reg?.active) return reg;
  const worker = reg?.installing || reg?.waiting;
  if (worker && worker.state !== 'activated') {
    await Promise.race([
      new Promise((resolve, reject) => {
        const done = () => {
          if (worker.state === 'activated') {
            worker.removeEventListener('statechange', done);
            resolve();
          } else if (worker.state === 'redundant') {
            worker.removeEventListener('statechange', done);
            reject(new Error('Service worker became redundant.'));
          }
        };
        worker.addEventListener('statechange', done);
        done();
      }),
      laterError(10000, 'Service worker activation timed out.'),
    ]);
  }
  if (reg?.active) return reg;
  const ready = await Promise.race([navigator.serviceWorker.ready, laterError(10000, 'No active service worker became ready.')]);
  if (!ready?.active) throw new Error('No active service worker found.');
  return ready;
}

async function inspectWorkers() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return { pwa: 'unsupported', messaging: 'unsupported' };
  const [pwa, messagingReg] = await Promise.all([
    navigator.serviceWorker.getRegistration('/pwa/').catch(() => null),
    navigator.serviceWorker.getRegistration('/').catch(() => null),
  ]);
  return { pwa: swState(pwa), messaging: swState(messagingReg) };
}

async function getPushConfig() {
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return { vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY };
  const data = await apiCall('/api/admin/push/vapid-key');
  if (!data?.publicKey) throw new Error('VAPID key missing.');
  return { vapidKey: data.publicKey };
}

async function enableBrowserPush() {
  if (!messaging) throw new Error('Firebase messaging unavailable.');
  if (typeof Notification === 'undefined') throw new Error('Notifications are not supported.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission denied.');
  const { vapidKey } = await getPushConfig();
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  const activeReg = await waitForActive(reg);
  const token = await getFirebaseToken(messaging, { vapidKey, serviceWorkerRegistration: activeReg });
  if (!token) throw new Error('Failed to retrieve device token from Firebase.');
  await apiCall('/api/admin/push/subscribe', { method: 'POST', body: JSON.stringify({ fcmToken: token, platform: 'web' }) });
}

function Badge({ value }) {
  return (
    <UiBadge className="border-white/10 bg-white/10 text-white" variant="secondary">
      {nice(value) || 'unknown'}
    </UiBadge>
  );
}

function Section({ title, action, children }) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl leading-none tracking-tight text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ title, sub, right, onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={cn(
        'flex w-full items-start justify-between gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left text-white transition-all duration-200',
        onClick && 'hover:border-primary/30 hover:bg-primary/10',
        active && 'border-primary/40 bg-primary/10'
      )}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold tracking-[0.02em] text-white">{title}</div>
        {sub ? <div className="mt-1 text-sm leading-6 text-white/60">{sub}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </Tag>
  );
}

function Input({ label, value, onChange, type = 'text', rows = 0 }) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{label}</span>
      {rows ? (
        <textarea
          className="min-h-[132px] rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-colors duration-200 placeholder:text-white/35 focus:border-primary/40"
          onChange={onChange}
          rows={rows}
          value={value}
        />
      ) : (
        <TextInput
          className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:ring-primary/40"
          onChange={onChange}
          type={type}
          value={value}
        />
      )}
    </label>
  );
}

function Sheet({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/70 px-3 pb-0 pt-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[84svh] w-full overflow-hidden rounded-t-[28px] border border-white/10 bg-[#12151d] shadow-velvet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-white/20" />
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
          <h3 className="font-display text-3xl leading-none tracking-tight text-white">{title}</h3>
          <Button onClick={onClose} size="sm" type="button" variant="outline">
            Close
          </Button>
        </div>
        <div className="max-h-[calc(84svh-132px)] overflow-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-white/10 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true); setError('');
    try {
      const data = await apiCall('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setToken(data.token);
      onLogin(data.admin);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="flex min-h-[100svh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border-white/10 bg-[#12151d]/90 text-white">
        <CardContent className="space-y-6 p-6">
          <UiBadge className="border-primary/20 bg-primary/10 text-primary" variant="default">
            Super admin PWA
          </UiBadge>
          <div className="space-y-3">
            <h1 className="font-display text-5xl leading-none tracking-tight text-white">
              Mobile command center.
            </h1>
            <p className="text-sm leading-7 text-white/60">
              Review payments, subscribers, support, and approvals with a cleaner touch-first admin surface.
            </p>
          </div>
          <div className="grid gap-4">
            <Input label="Email" onChange={(e) => setEmail(e.target.value)} type="email" value={email} />
            <Input label="Password" onChange={(e) => setPassword(e.target.value)} type="password" value={password} />
          </div>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Button className="w-full" disabled={loading} onClick={submit} size="lg" type="button">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Home({ admin, goto }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    const results = await Promise.allSettled([
      apiCall('/api/admin/dashboard'),
      apiCall('/api/admin/refunds?status=pending&limit=5'),
      apiCall('/api/admin/affiliates?status=pending&limit=5'),
      apiCall('/api/admin/support/inbox?status=open&limit=5'),
      apiCall('/api/admin/physical-orders?fulfillmentStatus=pending&limit=5'),
    ]);
    if (results[0].status !== 'fulfilled') setError(results[0].reason.message);
    setData({
      dashboard: results[0].status === 'fulfilled' ? results[0].value : null,
      refunds: results[1].status === 'fulfilled' ? results[1].value.refunds || [] : [],
      affiliates: results[2].status === 'fulfilled' ? results[2].value.affiliates || [] : [],
      support: results[3].status === 'fulfilled' ? results[3].value : null,
      orders: results[4].status === 'fulfilled' ? results[4].value.orders || [] : [],
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const d = data?.dashboard;
  const queue = [
    ['Refunds', data?.refunds?.length || 0, 'approvals'],
    ['Affiliates', data?.affiliates?.length || 0, 'approvals'],
    ['Support', Number(data?.support?.stats?.open_count || 0), 'support'],
    ['Orders', data?.orders?.length || 0, 'approvals'],
  ];
  return <div className="stack"><div className="hero panel"><div><div className="eyebrow">Welcome back</div><h1>{admin?.name?.split(' ')[0] || 'Admin'}</h1><p className="muted">Revenue, queues, and recent platform activity.</p></div><button className="btn ghost" onClick={load}>Refresh</button></div>{error ? <div className="notice err">{error}</div> : null}<Section title="Today">{loading && !d ? <div className="panel muted">Loading dashboard...</div> : null}{d ? <div className="grid">{[['Revenue', fmtMoney(d.revenue?.revenue_today), 'Today'], ['New users', d.users?.new_today || 0, 'Today'], ['Active', d.users?.active_subscribers || 0, 'Subscribers'], ['Payments', d.revenue?.total_payments || 0, 'Successful']].map(([label, value, sub]) => <div key={label} className="panel stat"><div className="muted tiny">{label}</div><div className="big">{value}</div><div className="muted">{sub}</div></div>)}</div> : null}</Section><Section title="Needs attention"><div className="grid">{queue.map(([label, count, tab]) => <button key={label} className="panel stat link" onClick={() => goto(tab)}><div className="big">{count}</div><div>{label}</div></button>)}</div></Section><Section title="Recent transactions"><div className="panel list">{(d?.recentTransactions || []).slice(0, 5).map((item) => <Row key={item.id} title={item.user_name || item.user_email} sub={`${fmtMoney(item.amount_inr)} • ${item.plan || 'plan'} • ${fmtDateTime(item.created_at)}`} right={<Badge value={item.status} />} />)}{!d?.recentTransactions?.length ? <div className="muted empty">No recent transactions.</div> : null}</div></Section><Section title="Recent subscribers"><div className="panel list">{(d?.recentSubscribers || []).slice(0, 5).map((item) => <Row key={item.id} title={item.name || item.email} sub={`${item.email} • ${fmtDate(item.created_at)}`} right={<Badge value={item.subscription_status} />} onClick={() => goto('subscribers')} />)}{!d?.recentSubscribers?.length ? <div className="muted empty">No recent subscribers.</div> : null}</div></Section></div>;
}

function Activity({ route, goto }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState(route.activityType || '');
  const buildItems = (payload) => {
    const next = [];
    (payload.dashboard?.recentTransactions || []).forEach((item) => next.push({
      id: `payment-${item.id}`,
      type: 'payment',
      at: item.created_at,
      title: `${fmtMoney(item.amount_inr)} received`,
      sub: `${item.user_name || item.user_email} • ${item.plan || 'plan'}`,
      targetTab: 'subscribers',
      route: { userId: item.user_id || '', paymentId: item.razorpay_payment_id || '' },
    }));
    (payload.dashboard?.recentSubscribers || []).forEach((item) => next.push({
      id: `subscriber-${item.id}`,
      type: 'subscriber',
      at: item.created_at,
      title: item.name || item.email,
      sub: `New subscriber • ${item.email}`,
      targetTab: 'subscribers',
      route: { userId: item.id },
    }));
    (payload.support?.tickets || []).forEach((item) => next.push({
      id: `support-${item.id}`,
      type: 'support',
      at: item.last_message_at || item.received_at,
      title: item.subject || '(No subject)',
      sub: `${item.from_name || item.from_email} • ${nice(item.ticket_status)}`,
      targetTab: 'support',
      route: { ticketId: item.id },
    }));
    (payload.affiliates || []).forEach((item) => next.push({
      id: `affiliate-${item.id}`,
      type: 'affiliate',
      at: item.created_at,
      title: item.name,
      sub: `Affiliate application • ${item.email}`,
      targetTab: 'approvals',
      route: { affiliateId: item.id },
    }));
    (payload.refunds || []).forEach((item) => next.push({
      id: `refund-${item.id}`,
      type: 'refund',
      at: item.created_at,
      title: `${fmtMoney(item.requested_amount_inr || item.transaction_amount_inr)} refund`,
      sub: item.user_name || item.user_email || 'Refund request',
      targetTab: 'approvals',
      route: { refundId: item.id },
    }));
    (payload.orders || []).forEach((item) => next.push({
      id: `order-${item.id}`,
      type: 'order',
      at: item.created_at,
      title: `${item.order_type === 'nfc_tag' ? 'NFC tag' : 'QR print'} order`,
      sub: `${item.shipping_name} • ${item.shipping_city}, ${item.shipping_state}`,
      targetTab: 'approvals',
      route: { orderId: item.id },
    }));
    return next.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  };
  const load = async () => {
    setLoading(true); setError('');
    const results = await Promise.allSettled([
      apiCall('/api/admin/dashboard'),
      apiCall('/api/admin/support/inbox?limit=8'),
      apiCall('/api/admin/affiliates?status=pending&limit=8'),
      apiCall('/api/admin/refunds?limit=8'),
      apiCall('/api/admin/physical-orders?limit=8'),
    ]);
    const payload = {
      dashboard: results[0].status === 'fulfilled' ? results[0].value : null,
      support: results[1].status === 'fulfilled' ? results[1].value : null,
      affiliates: results[2].status === 'fulfilled' ? results[2].value.affiliates || [] : [],
      refunds: results[3].status === 'fulfilled' ? results[3].value.refunds || [] : [],
      orders: results[4].status === 'fulfilled' ? results[4].value.orders || [] : [],
    };
    if (!payload.dashboard && !payload.support) setError('Unable to load activity feed.');
    const next = buildItems(payload);
    setItems(next);
    if (route.activityType || route.userId || route.ticketId || route.affiliateId || route.refundId || route.orderId || route.paymentId) {
      const match = next.find((item) => (
        (!route.activityType || item.type === route.activityType) &&
        (!route.userId || item.route.userId === route.userId) &&
        (!route.ticketId || item.route.ticketId === route.ticketId) &&
        (!route.affiliateId || item.route.affiliateId === route.affiliateId) &&
        (!route.refundId || item.route.refundId === route.refundId) &&
        (!route.orderId || item.route.orderId === route.orderId) &&
        (!route.paymentId || item.route.paymentId === route.paymentId)
      ));
      if (match) setSelected(match);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [route.activityType, route.userId, route.ticketId, route.affiliateId, route.refundId, route.orderId, route.paymentId]);
  const visible = filter ? items.filter((item) => item.type === filter) : items;
  return <div className="stack"><Section title="Activity" action={<button className="btn ghost" onClick={load}>Refresh</button>}><div className="toolbar"><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All activity</option>{['payment', 'subscriber', 'support', 'affiliate', 'refund', 'order'].map((value) => <option key={value} value={value}>{nice(value)}</option>)}</select></div>{error ? <div className="notice err">{error}</div> : null}<div className="panel list">{loading ? <div className="muted empty">Loading activity...</div> : null}{!loading && !visible.length ? <div className="muted empty">No activity in this filter.</div> : null}{visible.map((item) => <Row key={item.id} title={item.title} sub={`${nice(item.type)} • ${item.sub} • ${fmtDateTime(item.at)}`} right={<button className="btn small ghost" onClick={() => setSelected(item)}>View</button>} active={selected?.id === item.id} />)}</div></Section><Sheet open={Boolean(selected)} title={selected?.title || 'Activity'} onClose={() => setSelected(null)} footer={<button className="btn primary wide" onClick={() => selected && goto(selected.targetTab, { activityType: selected.type, ...selected.route })}>Open record</button>}>{selected ? <div className="stack"><div className="panel"><div className="muted tiny">Type</div><div>{nice(selected.type)}</div><div className="muted tiny" style={{ marginTop: 12 }}>When</div><div>{fmtDateTime(selected.at)}</div><div className="muted tiny" style={{ marginTop: 12 }}>Context</div><div>{selected.sub}</div></div></div> : null}</Sheet></div>;
}

function Subscribers({ route }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [config, setConfig] = useState(null);
  const [albumFocus, setAlbumFocus] = useState(null);
  const [txFocus, setTxFocus] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', subscriptionStatus: 'active', subscriptionPlan: 'monthly', isActive: 'true', notes: '' });
  const [override, setOverride] = useState({ expiry: '', note: '' });
  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await apiCall(`/api/admin/users${qs({ limit: 25, search: search.trim(), status, plan })}`);
      setItems(data.users || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  const open = async (item) => {
    setSelected(item); setDetail(null); setConfig(null);
    try {
      const [a, b] = await Promise.all([apiCall(`/api/admin/users/${item.id}`), apiCall(`/api/admin/users/${item.id}/subscription-config`)]);
      setDetail(a); setConfig(b);
      setForm({
        name: a.user?.name || '',
        email: a.user?.email || '',
        phone: a.user?.phone || '',
        subscriptionStatus: a.user?.subscription_status || 'active',
        subscriptionPlan: a.user?.subscription_plan || 'monthly',
        isActive: String(Boolean(a.user?.is_active)),
        notes: a.user?.notes || '',
      });
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, [search, status, plan]);
  useEffect(() => {
    if (!route?.userId || !items.length) return;
    const match = items.find((item) => item.id === route.userId);
    if (match && selected?.id !== match.id) open(match);
  }, [route?.userId, items]);
  useEffect(() => {
    if (!detail) return;
    if (route?.albumId) {
      const album = (detail.albums || []).find((item) => item.id === route.albumId);
      if (album) setAlbumFocus(album);
    }
    if (route?.paymentId) {
      const tx = (detail.transactions || []).find((item) => item.razorpay_payment_id === route.paymentId);
      if (tx) setTxFocus(tx);
    }
  }, [route?.albumId, route?.paymentId, detail]);
  const save = async () => {
    try {
      await apiCall(`/api/admin/users/${selected.id}`, { method: 'PUT', body: JSON.stringify({ ...form, isActive: form.isActive === 'true' }) });
      await load(); await open(selected);
    } catch (err) { setError(err.message); }
  };
  const saveOverride = async () => {
    const body = {};
    if (override.expiry) body.overrideExpiry = override.expiry;
    if (override.note.trim()) body.overrideNote = override.note.trim();
    if (!Object.keys(body).length) return;
    try {
      await apiCall(`/api/admin/users/${selected.id}/subscription-config`, { method: 'PATCH', body: JSON.stringify(body) });
      setOverride({ expiry: '', note: '' });
      await open(selected);
    } catch (err) { setError(err.message); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${selected?.name || selected?.email}?`)) return;
    try {
      await apiCall(`/api/admin/users/${selected.id}`, { method: 'DELETE' });
      setSelected(null); setDetail(null); setConfig(null); await load();
    } catch (err) { setError(err.message); }
  };
  const toggleAlbumPublish = async (album) => {
    try {
      await apiCall(`/api/admin/albums/${album.id}`, { method: 'PUT', body: JSON.stringify({ isPublished: !album.is_published }) });
      await open(selected);
      if (albumFocus?.id === album.id) setAlbumFocus({ ...albumFocus, is_published: !album.is_published });
    } catch (err) { setError(err.message); }
  };
  const deleteAlbum = async (album) => {
    if (!window.confirm(`Delete album "${album.name}"?`)) return;
    try {
      await apiCall(`/api/admin/albums/${album.id}`, { method: 'DELETE' });
      setAlbumFocus(null);
      await open(selected);
      await load();
    } catch (err) { setError(err.message); }
  };
  const openAlbum = (album) => {
    const path = album.type === 'wedding' ? `/wedding/${album.slug}` : `/album/${album.slug}`;
    window.open(path, '_blank', 'noopener,noreferrer');
  };
  const activeSub = config?.subscriptions?.find((item) => ['active', 'trialing'].includes(item.status));
  return <div className="stack"><Section title="Subscribers" action={<button className="btn ghost" onClick={load}>Refresh</button>}><div className="toolbar"><input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{USER_STATUSES.map((value) => <option key={value} value={value}>{nice(value)}</option>)}</select><select value={plan} onChange={(e) => setPlan(e.target.value)}><option value="">All plans</option>{USER_PLANS.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>{error ? <div className="notice err">{error}</div> : null}<div className="panel list">{loading ? <div className="muted empty">Loading subscribers...</div> : null}{!loading && !items.length ? <div className="muted empty">No matching subscribers.</div> : null}{items.map((item) => <Row key={item.id} title={item.name || item.email} sub={`${item.email} • ${fmtMoney(item.total_paid)} • ${item.album_count || 0} albums`} right={<Badge value={item.subscription_status} />} onClick={() => open(item)} active={selected?.id === item.id} />)}</div></Section>{selected ? <Section title={selected.name || selected.email}>{!detail ? <div className="panel muted">Loading subscriber details...</div> : <div className="stack"><div className="grid">{[['Total paid', fmtMoney(detail.user?.total_paid)], ['Albums', detail.user?.album_count || 0]].map(([label, value]) => <div key={label} className="panel stat"><div className="muted tiny">{label}</div><div className="big">{value}</div></div>)}</div><div className="panel"><Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" /><Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><label className="field"><span>Status</span><select value={form.subscriptionStatus} onChange={(e) => setForm({ ...form, subscriptionStatus: e.target.value })}>{USER_STATUSES.map((value) => <option key={value} value={value}>{nice(value)}</option>)}</select></label><label className="field"><span>Plan</span><select value={form.subscriptionPlan} onChange={(e) => setForm({ ...form, subscriptionPlan: e.target.value })}>{USER_PLANS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="field"><span>Account</span><select value={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.value })}><option value="true">Active</option><option value="false">Inactive</option></select></label><Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /><div className="btn-row"><button className="btn ghost" onClick={remove}>Delete</button><button className="btn primary" onClick={save}>Save</button></div></div><div className="panel"><div className="muted tiny">Subscription override</div>{activeSub ? <div className="muted">Ends {fmtDate(activeSub.override_expiry || activeSub.current_period_end)}</div> : <div className="muted">No active subscription config.</div>}<Input label="Expiry override" value={override.expiry} onChange={(e) => setOverride({ ...override, expiry: e.target.value })} type="date" /><Input label="Reason" value={override.note} onChange={(e) => setOverride({ ...override, note: e.target.value })} rows={2} /><button className="btn ghost wide" onClick={saveOverride}>Apply override</button></div><div className="panel list"><div className="muted tiny">Albums</div>{(detail.albums || []).slice(0, 8).map((album) => <Row key={album.id} title={album.name} sub={`${album.slug} • ${fmtDate(album.created_at)}`} right={<button className="btn small ghost" onClick={() => setAlbumFocus(album)}>Open</button>} />)}{!detail.albums?.length ? <div className="muted empty">No albums yet.</div> : null}</div><div className="panel list"><div className="muted tiny">Transactions</div>{(detail.transactions || []).slice(0, 8).map((tx) => <Row key={tx.id} title={`${fmtMoney(tx.amount_inr)} • ${tx.plan || 'plan'}`} sub={`${tx.payment_method || 'method'} • ${fmtDateTime(tx.created_at)}`} right={<button className="btn small ghost" onClick={() => setTxFocus(tx)}>Details</button>} />)}{!detail.transactions?.length ? <div className="muted empty">No transactions yet.</div> : null}</div></div>}</Section> : null}<Sheet open={Boolean(albumFocus)} title={albumFocus?.name || 'Album'} onClose={() => setAlbumFocus(null)} footer={<div className="btn-row"><button className="btn ghost" onClick={() => deleteAlbum(albumFocus)}>Delete</button><button className="btn primary" onClick={() => toggleAlbumPublish(albumFocus)}>{albumFocus?.is_published ? 'Unpublish' : 'Publish'}</button></div>}>{albumFocus ? <div className="stack"><div className="panel"><div className="muted tiny">Slug</div><div>{albumFocus.slug}</div><div className="muted tiny" style={{ marginTop: 12 }}>Created</div><div>{fmtDateTime(albumFocus.created_at)}</div><div className="muted tiny" style={{ marginTop: 12 }}>Status</div><div>{albumFocus.is_published ? 'Published' : 'Draft'}</div></div><button className="btn ghost wide" onClick={() => openAlbum(albumFocus)}>Open public album</button></div> : null}</Sheet><Sheet open={Boolean(txFocus)} title="Transaction detail" onClose={() => setTxFocus(null)}>{txFocus ? <div className="stack"><div className="panel"><div className="muted tiny">Amount</div><div>{fmtMoney(txFocus.amount_inr)}</div><div className="muted tiny" style={{ marginTop: 12 }}>Status</div><div>{nice(txFocus.status)}</div><div className="muted tiny" style={{ marginTop: 12 }}>Method</div><div>{txFocus.payment_method || '-'}</div><div className="muted tiny" style={{ marginTop: 12 }}>Plan</div><div>{txFocus.plan || '-'}</div><div className="muted tiny" style={{ marginTop: 12 }}>Razorpay payment</div><div className="mono">{txFocus.razorpay_payment_id || '-'}</div><div className="muted tiny" style={{ marginTop: 12 }}>Razorpay subscription</div><div className="mono">{txFocus.razorpay_subscription_id || '-'}</div><div className="muted tiny" style={{ marginTop: 12 }}>Created</div><div>{fmtDateTime(txFocus.created_at)}</div></div></div> : null}</Sheet></div>;
}
function Approvals({ route }) {
  const [data, setData] = useState({ pendingRefunds: [], approvedRefunds: [], affiliates: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);
  const [refundForm, setRefundForm] = useState({ amount: '', notes: '' });
  const [affiliateForm, setAffiliateForm] = useState({ status: 'active', notes: '' });
  const [orderForm, setOrderForm] = useState({ fulfillmentStatus: 'processing', trackingNumber: '', trackingCarrier: '', adminNotes: '' });
  const load = async () => {
    setLoading(true); setError('');
    const results = await Promise.allSettled([
      apiCall('/api/admin/refunds?status=pending&limit=8'),
      apiCall('/api/admin/refunds?status=approved&limit=8'),
      apiCall('/api/admin/affiliates?status=pending&limit=8'),
      apiCall('/api/admin/physical-orders?fulfillmentStatus=pending&limit=8'),
    ]);
    setData({
      pendingRefunds: results[0].status === 'fulfilled' ? results[0].value.refunds || [] : [],
      approvedRefunds: results[1].status === 'fulfilled' ? results[1].value.refunds || [] : [],
      affiliates: results[2].status === 'fulfilled' ? results[2].value.affiliates || [] : [],
      orders: results[3].status === 'fulfilled' ? results[3].value.orders || [] : [],
    });
    if (results.every((item) => item.status !== 'fulfilled')) setError('Unable to load approval queues.');
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (route?.refundId) {
      const item = [...data.pendingRefunds, ...data.approvedRefunds].find((entry) => entry.id === route.refundId);
      if (item) openRefundSheet(item);
    }
    if (route?.affiliateId) {
      const item = data.affiliates.find((entry) => entry.id === route.affiliateId);
      if (item) openAffiliateSheet(item);
    }
    if (route?.orderId) {
      const item = data.orders.find((entry) => entry.id === route.orderId);
      if (item) openOrderSheet(item);
    }
  }, [route?.refundId, route?.affiliateId, route?.orderId, data.pendingRefunds, data.approvedRefunds, data.affiliates, data.orders]);
  const openRefundSheet = (refund) => {
    setRefundForm({ amount: String(refund.requested_amount_inr || refund.transaction_amount_inr || ''), notes: refund.admin_notes || '' });
    setSheet({ kind: 'refund', item: refund });
  };
  const submitRefund = async (status) => {
    try {
      await apiCall(`/api/admin/refunds/${sheet.item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          approvedAmountInr: status === 'approved' ? Number(refundForm.amount || 0) : undefined,
          adminNotes: refundForm.notes,
        }),
      });
      setSheet(null);
      await load();
    } catch (err) { setError(err.message); }
  };
  const processRefund = async (refund) => {
    if (!window.confirm(`Process refund for ${refund.user_name || refund.user_email}?`)) return;
    try { await apiCall(`/api/admin/refunds/${refund.id}/process`, { method: 'POST' }); await load(); } catch (err) { setError(err.message); }
  };
  const openAffiliateSheet = (affiliate, status = 'active') => {
    setAffiliateForm({ status, notes: affiliate.notes || '' });
    setSheet({ kind: 'affiliate', item: affiliate });
  };
  const submitAffiliate = async () => {
    try {
      await apiCall(`/api/admin/affiliates/${sheet.item.id}`, { method: 'PUT', body: JSON.stringify(affiliateForm) });
      setSheet(null);
      await load();
    } catch (err) { setError(err.message); }
  };
  const openOrderSheet = (order) => {
    setOrderForm({
      fulfillmentStatus: order.fulfillment_status || 'pending',
      trackingNumber: order.tracking_number || '',
      trackingCarrier: order.tracking_carrier || '',
      adminNotes: order.admin_notes || '',
    });
    setSheet({ kind: 'order', item: order });
  };
  const submitOrder = async () => {
    try {
      await apiCall(`/api/admin/physical-orders/${sheet.item.id}`, { method: 'PATCH', body: JSON.stringify(orderForm) });
      setSheet(null);
      await load();
    } catch (err) { setError(err.message); }
  };
  return <div className="stack"><Section title="Approvals" action={<button className="btn ghost" onClick={load}>Refresh</button>}>{error ? <div className="notice err">{error}</div> : null}{loading ? <div className="panel muted">Loading queues...</div> : null}</Section><Section title="Pending refunds"><div className="panel list">{data.pendingRefunds.map((item) => <Row key={item.id} title={item.user_name || item.user_email} sub={`${fmtMoney(item.requested_amount_inr || item.transaction_amount_inr)} • ${fmtDateTime(item.created_at)}`} right={<button className="btn small primary" onClick={() => openRefundSheet(item)}>Review</button>} />)}{!data.pendingRefunds.length && !loading ? <div className="muted empty">No pending refunds.</div> : null}</div></Section><Section title="Approved refunds"><div className="panel list">{data.approvedRefunds.map((item) => <Row key={item.id} title={item.user_name || item.user_email} sub={`${fmtMoney(item.approved_amount_inr || item.requested_amount_inr)} • ${item.razorpay_payment_id || 'No payment id'}`} right={<button className="btn small primary" onClick={() => processRefund(item)}>Process</button>} />)}{!data.approvedRefunds.length && !loading ? <div className="muted empty">No approved refunds waiting.</div> : null}</div></Section><Section title="Affiliate applications"><div className="panel list">{data.affiliates.map((item) => <Row key={item.id} title={item.name} sub={`${item.email} • ${item.business_name || 'No business name'}`} right={<button className="btn small primary" onClick={() => openAffiliateSheet(item)}>Review</button>} />)}{!data.affiliates.length && !loading ? <div className="muted empty">No pending affiliate applications.</div> : null}</div></Section><Section title="Physical orders"><div className="panel list">{data.orders.map((item) => <Row key={item.id} title={`${item.shipping_name} • ${item.order_type === 'nfc_tag' ? 'NFC tag' : 'QR print'}`} sub={`${item.shipping_city}, ${item.shipping_state} • ${fmtMoney(Number(item.amount_paise || 0) / 100)}`} right={<button className="btn small ghost" onClick={() => openOrderSheet(item)}>Update</button>} />)}{!data.orders.length && !loading ? <div className="muted empty">No pending physical orders.</div> : null}</div></Section><Sheet open={Boolean(sheet)} title={sheet?.kind === 'refund' ? 'Review refund' : sheet?.kind === 'affiliate' ? 'Review affiliate' : 'Update order'} onClose={() => setSheet(null)} footer={sheet?.kind === 'refund' ? <div className="btn-row"><button className="btn ghost" onClick={() => submitRefund('rejected')}>Reject</button><button className="btn primary" onClick={() => submitRefund('approved')}>Approve</button></div> : <button className="btn primary wide" onClick={() => sheet?.kind === 'affiliate' ? submitAffiliate() : submitOrder()}>Save</button>}>{sheet?.kind === 'refund' ? <div className="stack"><Input label="Approved amount (INR)" value={refundForm.amount} onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })} type="number" /><Input label="Notes" value={refundForm.notes} onChange={(e) => setRefundForm({ ...refundForm, notes: e.target.value })} rows={3} /></div> : null}{sheet?.kind === 'affiliate' ? <div className="stack"><label className="field"><span>Status</span><select value={affiliateForm.status} onChange={(e) => setAffiliateForm({ ...affiliateForm, status: e.target.value })}><option value="active">Active</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></label><Input label="Notes" value={affiliateForm.notes} onChange={(e) => setAffiliateForm({ ...affiliateForm, notes: e.target.value })} rows={3} /></div> : null}{sheet?.kind === 'order' ? <div className="stack"><label className="field"><span>Fulfillment status</span><select value={orderForm.fulfillmentStatus} onChange={(e) => setOrderForm({ ...orderForm, fulfillmentStatus: e.target.value })}>{ORDER_STATUSES.map((value) => <option key={value} value={value}>{nice(value)}</option>)}</select></label><Input label="Tracking number" value={orderForm.trackingNumber} onChange={(e) => setOrderForm({ ...orderForm, trackingNumber: e.target.value })} /><Input label="Carrier" value={orderForm.trackingCarrier} onChange={(e) => setOrderForm({ ...orderForm, trackingCarrier: e.target.value })} /><Input label="Admin notes" value={orderForm.adminNotes} onChange={(e) => setOrderForm({ ...orderForm, adminNotes: e.target.value })} rows={3} /></div> : null}</Sheet></div>;
}

function Support({ admin, route }) {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState(route?.ticketId ? 'all' : 'open');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [subject, setSubject] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await apiCall(`/api/admin/support/inbox${qs({ status, limit: 20 })}`);
      setItems(data.tickets || []); setStats(data.stats || null);
      const next = selected && (data.tickets || []).some((item) => item.id === selected.id) ? selected : data.tickets?.[0] || null;
      if (next) await open(next);
      else { setSelected(null); setDetail(null); }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  const open = async (item) => {
    setSelected(item);
    try {
      const data = await apiCall(`/api/admin/support/inbox/${item.id}`);
      setDetail(data);
      setSubject(data.ticket?.subject?.match(/^re:/i) ? data.ticket.subject : `Re: ${data.ticket?.subject || 'Support'}`);
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    if (!route?.ticketId || !items.length) return;
    const match = items.find((item) => item.id === route.ticketId);
    if (match && selected?.id !== match.id) open(match);
  }, [route?.ticketId, items]);
  const update = async (payload) => {
    try { await apiCall(`/api/admin/support/inbox/${selected.id}`, { method: 'PUT', body: JSON.stringify(payload) }); await load(); } catch (err) { setError(err.message); }
  };
  const send = async () => {
    try { await apiCall(`/api/admin/support/inbox/${selected.id}/reply`, { method: 'POST', body: JSON.stringify({ subject, bodyText: reply }) }); setReply(''); await load(); } catch (err) { setError(err.message); }
  };
  return <div className="stack"><Section title="Support inbox" action={<button className="btn ghost" onClick={load}>Refresh</button>}><div className="toolbar"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{SUPPORT_STATUSES.map((value) => <option key={value} value={value}>{nice(value)}</option>)}</select>{stats ? <div className="muted">Open {stats.open_count || 0} • In progress {stats.in_progress_count || 0}</div> : null}</div>{error ? <div className="notice err">{error}</div> : null}<div className="panel list">{loading ? <div className="muted empty">Loading inbox...</div> : null}{!loading && !items.length ? <div className="muted empty">No tickets in this state.</div> : null}{items.map((item) => <Row key={item.id} title={item.subject || '(No subject)'} sub={`${item.from_name || item.from_email} • ${item.preview_text?.slice(0, 70) || 'No preview'}`} right={<Badge value={item.ticket_status} />} onClick={() => open(item)} active={selected?.id === item.id} />)}</div></Section>{selected ? <Section title={selected.subject || 'Support thread'} action={<button className="btn ghost" onClick={() => update({ assignedAdminId: admin?.id, ticketStatus: 'in_progress' })}>Claim</button>}>{!detail ? <div className="panel muted">Loading thread...</div> : <div className="stack"><label className="field"><span>Status</span><select value={detail.ticket?.ticket_status || 'open'} onChange={(e) => update({ ticketStatus: e.target.value })}>{SUPPORT_STATUSES.map((value) => <option key={value} value={value}>{nice(value)}</option>)}</select></label><div className="panel list thread">{(detail.messages || []).map((item) => <div key={`${item.source}-${item.id}`} className={`bubble ${item.direction === 'outbound' ? 'out' : ''}`}><div className="muted tiny">{item.from_name || item.from_email} • {fmtDateTime(item.created_at)}</div><div>{item.body_text}</div></div>)}</div><Input label="Reply subject" value={subject} onChange={(e) => setSubject(e.target.value)} /><Input label="Reply body" value={reply} onChange={(e) => setReply(e.target.value)} rows={5} /><button className="btn primary wide" onClick={send} disabled={!reply.trim()}>Send reply</button></div>}</Section> : null}</div>;
}
function Settings() {
  const [groups, setGroups] = useState({});
  const [drafts, setDrafts] = useState({});
  const [group, setGroup] = useState('');
  const [workers, setWorkers] = useState({ pwa: 'checking', messaging: 'checking' });
  const [devices, setDevices] = useState([]);
  const [pushMsg, setPushMsg] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const load = async () => {
    setError('');
    try {
      const [settings, devs, sw] = await Promise.all([apiCall('/api/admin/settings'), apiCall('/api/admin/push/devices').catch(() => ({ devices: [] })), inspectWorkers()]);
      setGroups(settings.settings || {}); setDevices(devs.devices || []); setWorkers(sw);
      const next = {};
      (settings.flat || []).forEach((item) => { next[item.key] = String(String(item.type || '').toLowerCase() === 'boolean' ? truthy(item.value) : item.value ?? ''); });
      setDrafts(next);
      const keys = Object.keys(settings.settings || {});
      if (keys.length && !keys.includes(group)) setGroup(keys[0]);
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []);
  const saveGroup = async () => {
    const items = (groups[group] || []).filter((item) => String(drafts[item.key]) !== String(String(item.type || '').toLowerCase() === 'boolean' ? truthy(item.value) : item.value ?? '')).map((item) => ({ key: item.key, value: drafts[item.key] }));
    if (!items.length) return;
    try { await apiCall('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ settings: items }) }); await load(); } catch (err) { setError(err.message); }
  };
  const sendTest = async () => {
    try { await apiCall('/api/admin/push/test', { method: 'POST' }); setPushMsg('Test notification sent.'); } catch (err) { setPushMsg(err.message); }
  };
  const enablePushNow = async () => {
    try { await enableBrowserPush(); setPushMsg('Push enabled on this device.'); await load(); } catch (err) { setPushMsg(err.message); }
  };
  const changePassword = async () => {
    try { await apiCall('/api/admin/auth/change-password', { method: 'PUT', body: JSON.stringify(password) }); setPassword({ currentPassword: '', newPassword: '' }); } catch (err) { setError(err.message); }
  };
  const current = groups[group] || [];
  return <div className="stack"><Section title="Push and device"><div className="panel"><div className="muted">PWA worker: {workers.pwa}</div><div className="muted">Messaging worker: {workers.messaging}</div><div className="muted">Registered devices: {devices.length}</div><div className="btn-row"><button className="btn primary" onClick={enablePushNow}>Enable push</button><button className="btn ghost" onClick={sendTest}>Send test</button></div>{pushMsg ? <div className="notice info">{pushMsg}</div> : null}</div></Section><Section title="Settings">{error ? <div className="notice err">{error}</div> : null}<div className="toolbar"><select value={group} onChange={(e) => setGroup(e.target.value)}>{Object.keys(groups).map((value) => <option key={value} value={value}>{nice(value)}</option>)}</select><button className="btn ghost" onClick={saveGroup}>Save group</button></div><div className="panel">{current.map((item) => <label key={item.key} className="field"><span>{item.label || item.key}</span>{String(item.type || '').toLowerCase() === 'boolean' ? <select value={drafts[item.key] || 'false'} onChange={(e) => setDrafts({ ...drafts, [item.key]: e.target.value })}><option value="true">Enabled</option><option value="false">Disabled</option></select> : <input value={drafts[item.key] || ''} onChange={(e) => setDrafts({ ...drafts, [item.key]: e.target.value })} />}</label>)}</div></Section><Section title="Password"><div className="panel"><Input label="Current password" value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} type="password" /><Input label="New password" value={password.newPassword} onChange={(e) => setPassword({ ...password, newPassword: e.target.value })} type="password" /><button className="btn primary wide" onClick={changePassword}>Update password</button></div></Section></div>;
}

export default function PWAApp() {
  const [mounted, setMounted] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState('home');
  const [route, setRoute] = useState({ tab: 'home' });
  const navItems = [
    ['home', 'Home', HomeIcon],
    ['activity', 'Activity', ActivityIcon],
    ['subscribers', 'People', Users],
    ['approvals', 'Queues', ClipboardList],
    ['support', 'Support', MessageSquare],
    ['settings', 'Settings', SettingsIcon],
  ];
  useEffect(() => {
    setMounted(true);
    const nextRoute = readRoute();
    setRoute(nextRoute);
    setTab(nextRoute.tab || initialTab());
    const token = getToken();
    if (!token) return;
    apiCall('/api/admin/auth/me').then((data) => setAdmin(data.admin || null)).catch(() => clearToken());
  }, []);
  const goto = (value, extra = {}) => startTransition(() => {
    const nextRoute = { tab: value, ...extra };
    setTab(value);
    setRoute(nextRoute);
    setRouteUrl(nextRoute);
  });
  if (!mounted) return null;
  return <>
    <Head>
      <title>Hriatrengna Admin PWA</title>
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
      <meta name="theme-color" content="#0c0d12" />
      <link rel="manifest" href="/pwa-manifest.json" />
    </Head>
    <style>{CSS}</style>
    {!admin ? (
      <Login onLogin={setAdmin} />
    ) : (
      <div className="app">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0c0d12]/90 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 rounded-[28px] border border-white/10 bg-white/[0.03] px-4 py-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                Super admin PWA
              </div>
              <div className="mt-1 font-display text-3xl leading-none tracking-tight text-white">
                Hriatrengna operations
              </div>
            </div>
            <Button
              onClick={() => {
                clearToken();
                setAdmin(null);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Sign out
            </Button>
          </div>
        </header>

        {tab === 'home' ? <Home admin={admin} goto={goto} /> : null}
        {tab === 'activity' ? <Activity route={route} goto={goto} /> : null}
        {tab === 'subscribers' ? <Subscribers route={route} /> : null}
        {tab === 'approvals' ? <Approvals route={route} /> : null}
        {tab === 'support' ? <Support admin={admin} route={route} /> : null}
        {tab === 'settings' ? <Settings /> : null}

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0c0d12]/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
          <div className="mx-auto grid max-w-4xl grid-cols-6 gap-2">
            {navItems.map(([value, label, Icon]) => (
              <button
                className={cn(
                  'flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl border text-[11px] font-medium transition-colors duration-200',
                  tab === value
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-transparent bg-white/[0.02] text-white/55'
                )}
                key={value}
                onClick={() => goto(value)}
                type="button"
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    )}
  </>;
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
  * { box-sizing:border-box; } body { margin:0; background:radial-gradient(circle at top right, rgba(210,176,96,.12), transparent 26%), #0c0d12; color:#f5f7fb; font-family:'DM Sans',system-ui,sans-serif; } button,input,select,textarea { font:inherit; } input,select,textarea { width:100%; padding:12px 14px; border-radius:14px; border:1px solid rgba(255,255,255,.12); background:#1b1f2a; color:#f5f7fb; } textarea { resize:vertical; }
  .app { min-height:100svh; padding-bottom:calc(76px + env(safe-area-inset-bottom)); } .top { position:sticky; top:0; z-index:10; display:flex; justify-content:space-between; align-items:center; gap:12px; padding:calc(14px + env(safe-area-inset-top)) 16px 14px; border-bottom:1px solid rgba(255,255,255,.08); background:rgba(12,13,18,.92); backdrop-filter:blur(14px); }
  .stack { padding:16px; display:grid; gap:16px; } .panel { background:#151821; border:1px solid rgba(255,255,255,.08); border-radius:20px; padding:16px; } .hero { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; background:linear-gradient(140deg, rgba(210,176,96,.14), rgba(255,255,255,.02)), #151821; }
  .sec { display:grid; gap:10px; } .sec-head { display:flex; justify-content:space-between; align-items:center; gap:12px; } .sec h2, .hero h1 { margin:0; } .hero p { margin:8px 0 0; }
  .btn { min-height:42px; padding:10px 14px; border-radius:14px; border:1px solid rgba(255,255,255,.12); background:transparent; color:#f5f7fb; cursor:pointer; } .btn.primary { background:#d2b060; color:#241805; border:none; font-weight:700; } .btn.ghost { background:transparent; } .btn.small { min-height:34px; padding:7px 10px; font-size:12px; }
  .nav { position:fixed; left:0; right:0; bottom:0; display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:6px; padding:10px 10px calc(10px + env(safe-area-inset-bottom)); background:rgba(12,13,18,.94); border-top:1px solid rgba(255,255,255,.08); backdrop-filter:blur(16px); } .nav-btn { min-height:46px; border:none; border-radius:14px; background:none; color:#9aa3b8; font-size:12px; } .nav-btn.on { background:rgba(210,176,96,.14); color:#d2b060; font-weight:700; }
  .title { font-weight:700; font-size:18px; } .login { min-height:100svh; display:flex; align-items:center; justify-content:center; padding:24px; } .login-card { width:min(100%, 420px); }
  .badge { padding:5px 9px; border-radius:999px; background:rgba(255,255,255,.08); font-size:11px; } .row { width:100%; display:flex; justify-content:space-between; gap:12px; padding:14px 0; background:none; border:none; border-bottom:1px solid rgba(255,255,255,.08); color:inherit; text-align:left; } .row:last-child { border-bottom:none; } .row.active { background:rgba(210,176,96,.08); margin:0 -16px; padding:14px 16px; } .row-title { font-weight:600; } .row-sub { color:#9aa3b8; font-size:13px; line-height:1.45; margin-top:4px; } .row-right { display:flex; align-items:center; gap:8px; }
  .field { display:grid; gap:6px; margin-bottom:10px; } .field span, .tiny { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#d2b060; } .eyebrow { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#d2b060; }
  .muted { color:#9aa3b8; } .big { font-size:26px; font-weight:700; letter-spacing:-.04em; margin-top:6px; } .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; } .stat { padding:14px; } .link { text-align:left; } .toolbar, .btn-row, .mini-actions { display:grid; gap:10px; } .btn-row { grid-template-columns:1fr 1fr; } .wide { width:100%; }
  .notice { padding:12px 14px; border-radius:14px; font-size:13px; line-height:1.45; } .notice.err { background:rgba(255,141,141,.14); color:#ffc6c6; } .notice.info { background:rgba(255,255,255,.06); color:#f5f7fb; } .empty { padding:18px 0; text-align:center; } .thread { gap:10px; } .bubble { padding:12px; border-radius:16px; border:1px solid rgba(255,255,255,.08); background:#11141c; } .bubble.out { background:rgba(210,176,96,.1); border-color:rgba(210,176,96,.2); }
  .sheet-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.62); display:flex; align-items:flex-end; z-index:30; } .sheet { width:100%; max-height:84svh; overflow:hidden; background:#12151d; border-top:1px solid rgba(255,255,255,.12); border-radius:24px 24px 0 0; } .sheet-handle { width:52px; height:5px; border-radius:999px; background:rgba(255,255,255,.18); margin:10px auto 0; } .sheet-head, .sheet-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; } .sheet-head { border-bottom:1px solid rgba(255,255,255,.08); } .sheet-foot { border-top:1px solid rgba(255,255,255,.08); padding-bottom:calc(14px + env(safe-area-inset-bottom)); } .sheet-head h3 { margin:0; } .sheet-body { padding:16px; max-height:calc(84svh - 120px); overflow:auto; } .mono { font-family:ui-monospace, SFMono-Regular, Consolas, monospace; word-break:break-all; }
  @media (max-width:480px) { .grid, .btn-row { grid-template-columns:1fr; } .hero { flex-direction:column; } }
`;
