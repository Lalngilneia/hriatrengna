import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  KeyRound,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import AuthScaffold from './AuthScaffold';
import { API, apiCall } from '../../lib/api';
import { saveToken, normalizeUserPayload } from '../../lib/auth';
import {
  captureReferralFromLocation,
  getReferralCode,
  persistReferralCode,
} from '../../lib/referral';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'lifetime'];

const FALLBACK_PUBLIC_PLANS = [
  { slug: 'memorial-standard', name: 'Memorial Standard - Rs 3,499 / year (Best Value)' },
  { slug: 'memorial-basic', name: 'Memorial Basic - Rs 499 / month' },
  { slug: 'wedding-classic', name: 'Wedding Classic - Rs 4,599 / year' },
  { slug: 'wedding-basic', name: 'Wedding Basic - Rs 999 / 6 months' },
];

function getPostLoginPage(user, audience = 'public') {
  if (audience === 'photographer') return 'studio';

  if (
    user?.isDemo ||
    user?.hasMemorial ||
    user?.hasWedding ||
    ACTIVE_SUBSCRIPTION_STATUSES.includes(user?.subscriptionStatus)
  ) {
    return 'dashboard';
  }

  return 'payment';
}

function getCopy(mode, audience = 'public') {
  if (audience === 'photographer') {
    if (mode === 'login') {
      return {
        eyebrow: 'Studio sign in',
        title: 'Return to your studio workspace.',
        sub: 'Access client delivery, billing, and your photographer tools from one place.',
        google: 'Continue with Google',
      };
    }

    return {
      eyebrow: 'Studio account',
      title: 'Create your studio access.',
      sub: 'Set up the photographer login first. You will choose your studio plan immediately after sign up.',
      google: 'Sign up with Google',
    };
  }

  if (mode === 'login') {
    return {
      eyebrow: 'Welcome back',
      title: 'Sign in to your albums and billing.',
      sub: 'Manage memorial and wedding pages, review subscriptions, and continue where you left off.',
      google: 'Continue with Google',
    };
  }

  return {
    eyebrow: 'Create your account',
    title: 'Start a polished memorial or wedding page.',
    sub: 'Open an account, choose a plan, and move into the editor with the same premium visual language visitors will see.',
    google: 'Sign up with Google',
  };
}

function consumerPlansFromResponse(plans) {
  return (plans || []).filter(
    (plan) =>
      plan?.product_type !== 'studio_photographer' &&
      !String(plan?.slug || '').startsWith('studio-')
  );
}

function LoaderLabel({ children }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LoaderCircle className="size-4 animate-spin" />
      {children}
    </span>
  );
}

function GoogleButton({ loading, onClick, label }) {
  return (
    <Button className="w-full justify-center" disabled={loading} onClick={onClick} type="button" variant="outline">
      <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.03 5.03 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" fill="#34A853" />
        <path d="M5.84 14.09A6.92 6.92 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
      </svg>
      {loading ? <LoaderLabel>Connecting...</LoaderLabel> : label}
    </Button>
  );
}

function FormField({ label, children }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium tracking-[0.02em] text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AuthCard({ children }) {
  return (
    <Card className="overflow-hidden border-white/70 bg-white/72">
      <CardContent className="p-6 sm:p-8">{children}</CardContent>
    </Card>
  );
}

function getHighlights(audience = 'public') {
  if (audience === 'photographer') {
    return [
      { icon: ShieldCheck, label: 'Protected studio access' },
      { icon: Sparkles, label: 'Consistent premium client experience' },
      { icon: Clock3, label: 'Fast handoff from sign up to billing' },
    ];
  }

  return [
    { icon: LockKeyhole, label: 'Secure access' },
    { icon: LifeBuoy, label: 'Built-in recovery flows' },
    { icon: Sparkles, label: 'Luxury editorial presentation' },
  ];
}

function AuthPage({
  mode,
  setPage,
  setUser,
  initialSignupMode,
  audience = 'public',
}) {
  const isPhotographer = audience === 'photographer';
  const copy = getCopy(mode, audience);
  const applyUser = typeof setUser === 'function' ? setUser : () => {};

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [plan, setPlan] = useState('memorial-standard');
  const [signupMode, setSignupMode] = useState(initialSignupMode || 'full');
  const [trialType, setTrialType] = useState('memorial');
  const [trialLoading, setTrialLoading] = useState(false);
  const [referralCode, setReferralCode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return getReferralCode(new URLSearchParams(window.location.search).get('ref'));
  });
  const [referralStatus, setReferralStatus] = useState('idle');
  const [referralMessage, setReferralMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'signup' || isPhotographer) {
      setPlans([]);
      return;
    }

    apiCall('/api/payments/plans')
      .then((data) => setPlans(consumerPlansFromResponse(data.plans)))
      .catch(() => {});
  }, [mode, isPhotographer]);

  useEffect(() => {
    if (typeof window === 'undefined' || isPhotographer) return;
    const captured = captureReferralFromLocation();
    if (mode === 'signup' && captured) setReferralCode(captured);
  }, [mode, isPhotographer]);

  const validateReferralCode = async (rawCode = referralCode) => {
    const normalized = rawCode.trim().toUpperCase();
    if (!normalized) {
      setReferralStatus('idle');
      setReferralMessage('');
      return true;
    }

    setReferralStatus('checking');
    try {
      const data = await apiCall(`/api/affiliates/validate/${encodeURIComponent(normalized)}`);
      setReferralStatus('valid');
      setReferralMessage(
        data.affiliate?.name ? `Referral linked to ${data.affiliate.name}.` : 'Referral code is valid.'
      );
      return true;
    } catch (err) {
      setReferralStatus('invalid');
      setReferralMessage(err.message);
      return false;
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const normalizedReferral = referralCode.trim().toUpperCase();
      if (mode === 'signup' && !isPhotographer && normalizedReferral) {
        const valid = await validateReferralCode(normalizedReferral);
        if (!valid) {
          setGoogleLoading(false);
          return;
        }
        persistReferralCode(normalizedReferral);
      } else {
        sessionStorage.removeItem('mqr_pending_referral_code');
      }

      sessionStorage.setItem('mqr_auth_entry', `${audience}:${mode}`);

      const { url } = await apiCall('/api/auth/google/url');
      window.location.href = url;
    } catch (err) {
      setError(err.message || 'Failed to connect with Google. Please try again.');
      setGoogleLoading(false);
    }
  };

  const submit = async () => {
    if (!email || !pass) {
      setError('Email and password are required.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!name) {
          setError('Name is required.');
          setLoading(false);
          return;
        }

        const normalizedReferral = referralCode.trim().toUpperCase();
        if (!isPhotographer && normalizedReferral) {
          const valid = await validateReferralCode(normalizedReferral);
          if (!valid) {
            setLoading(false);
            return;
          }
          persistReferralCode(normalizedReferral);
        }

        const payload = { name, email, password: pass };
        if (!isPhotographer) {
          payload.plan = plan;
          if (normalizedReferral) payload.referralCode = normalizedReferral;
        }

        const data = await apiCall('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        saveToken(data.token);
        applyUser(normalizeUserPayload({
          ...data.user,
          subscriptionPlan: isPhotographer ? null : plan,
        }));

        setPage(isPhotographer ? 'studio-billing' : 'payment');
        return;
      }

      const data = await apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      });

      saveToken(data.token);
      const normalizedUser = normalizeUserPayload(data.user);
      applyUser(normalizedUser);
      setPage(getPostLoginPage(normalizedUser, audience));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const planOptions = plans.length
    ? plans.map((p) => ({
        slug: p.slug,
        name: `${p.name} - ${p.price_display}/${p.interval}${p.is_featured ? ' (Best Value)' : ''}`,
      }))
    : FALLBACK_PUBLIC_PLANS;

  return (
    <AuthScaffold
      description={copy.sub}
      eyebrow={copy.eyebrow}
      highlights={getHighlights(audience)}
      sideBadge={isPhotographer ? 'Studio flow' : 'Public access'}
      sideCopy={isPhotographer
        ? 'Create or access the photographer workspace, then move directly into billing, team setup, and client delivery.'
        : 'Sign in, sign up, or start a trial without falling out of the premium public experience established on the landing page.'}
      sideTitle={isPhotographer ? 'Studio tools should feel as polished as the albums.' : 'The journey from interest to access should stay elegant.'}
      title={copy.title}
    >
      <AuthCard>
        <div className="space-y-6">
          <GoogleButton label={copy.google} loading={googleLoading} onClick={handleGoogleLogin} />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Or continue with email
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          {mode === 'signup' && !isPhotographer && (
            <Tabs onValueChange={setSignupMode} value={signupMode}>
              <TabsList className="w-full justify-center">
                <TabsTrigger value="full">Create account</TabsTrigger>
                <TabsTrigger value="trial">Free trial</TabsTrigger>
              </TabsList>
              <TabsContent value="full" />
              <TabsContent value="trial" />
            </Tabs>
          )}

          {mode === 'signup' && signupMode === 'trial' && !isPhotographer ? (
            <div className="space-y-5">
              <Alert variant="info">
                No credit card required. Trial access lasts 24 hours with up to 10 uploads before data expires automatically.
              </Alert>

              <Tabs onValueChange={setTrialType} value={trialType}>
                <TabsList>
                  <TabsTrigger value="memorial">Memorial</TabsTrigger>
                  <TabsTrigger value="wedding">Wedding</TabsTrigger>
                </TabsList>
                <TabsContent value="memorial" />
                <TabsContent value="wedding" />
              </Tabs>

              <Button
                className="w-full"
                disabled={trialLoading}
                onClick={async () => {
                  setTrialLoading(true);
                  setError('');
                  try {
                    const res = await fetch(`${API}/api/auth/demo`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: trialType }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to start trial');
                    saveToken(data.token);
                    applyUser(normalizeUserPayload(data.user));
                    setPage('dashboard');
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setTrialLoading(false);
                  }
                }}
                size="lg"
                type="button"
              >
                {trialLoading ? <LoaderLabel>Starting trial...</LoaderLabel> : `Start free ${trialType} trial`}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {mode === 'signup' && (
                <FormField label="Full name">
                  <Input onChange={(e) => setName(e.target.value)} placeholder="Your name" value={name} />
                </FormField>
              )}

              <FormField label="Email address">
                <Input
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                />
              </FormField>

              <FormField label="Password">
                <Input
                  onChange={(e) => setPass(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="Minimum 8 characters"
                  type="password"
                  value={pass}
                />
              </FormField>

              {mode === 'signup' && !isPhotographer && (
                <>
                  <FormField label="Choose your plan">
                    <Select onChange={(e) => setPlan(e.target.value)} value={plan}>
                      {planOptions.map((option) => (
                        <option key={option.slug} value={option.slug}>
                          {option.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Referral code">
                    <Input
                      onBlur={() => validateReferralCode()}
                      onChange={(e) => {
                        const nextCode = e.target.value.toUpperCase();
                        setReferralCode(nextCode);
                        if (nextCode.trim()) persistReferralCode(nextCode, { overwrite: true });
                        if (referralStatus !== 'idle') {
                          setReferralStatus('idle');
                          setReferralMessage('');
                        }
                      }}
                      placeholder="Optional affiliate code"
                      value={referralCode}
                    />
                  </FormField>

                  {referralMessage && (
                    <Alert
                      variant={
                        referralStatus === 'valid'
                          ? 'success'
                          : referralStatus === 'invalid'
                            ? 'error'
                            : 'info'
                      }
                    >
                      {referralStatus === 'checking' ? 'Checking referral code...' : referralMessage}
                    </Alert>
                  )}
                </>
              )}

              {mode === 'signup' && isPhotographer && (
                <Alert variant="info">
                  This creates your photographer login first. Studio billing comes immediately after sign up.
                </Alert>
              )}

              <Button className="w-full" disabled={loading} onClick={submit} size="lg" type="button">
                {loading ? <LoaderLabel>Please wait...</LoaderLabel> : mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </div>
          )}

          {mode === 'signup' && (
            <p className="text-center text-sm leading-7 text-muted-foreground">
              By continuing you agree to our{' '}
              <a className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline" href="/terms" rel="noopener noreferrer" target="_blank">
                Terms of Service
              </a>{' '}
              and{' '}
              <a className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline" href="/privacy" rel="noopener noreferrer" target="_blank">
                Privacy Policy
              </a>.
            </p>
          )}

          {mode === 'login' && (
            <div className="text-center">
              <button
                className="text-sm font-medium text-foreground transition-colors hover:text-primary"
                onClick={() => setPage('forgot-password')}
                type="button"
              >
                Forgot your password?
              </button>
            </div>
          )}

          <div className="text-center text-sm leading-7 text-muted-foreground">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              className="font-medium text-foreground transition-colors hover:text-primary"
              onClick={() => setPage(mode === 'login' ? 'signup' : 'login')}
              type="button"
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </div>
        </div>
      </AuthCard>
    </AuthScaffold>
  );
}

function ForgotPasswordPage({ setPage }) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email) {
      setError('Email is required.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await apiCall('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMsg('If an account exists with that email, a reset link has been sent. Check your inbox and spam folder.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      description="Enter the account email and we will send the password reset link immediately."
      eyebrow="Password recovery"
      highlights={[
        { icon: KeyRound, label: 'Secure reset links' },
        { icon: Mail, label: 'Email-based recovery' },
        { icon: ShieldCheck, label: 'Same account protections' },
      ]}
      title="Reset your password without losing momentum."
    >
      <AuthCard>
        <div className="space-y-5">
          {error && <Alert variant="error">{error}</Alert>}
          {msg ? (
            <Alert variant="success">{msg}</Alert>
          ) : (
            <>
              <FormField label="Email address">
                <Input
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                />
              </FormField>

              <Button className="w-full" disabled={loading} onClick={submit} size="lg" type="button">
                {loading ? <LoaderLabel>Sending link...</LoaderLabel> : 'Send reset link'}
              </Button>
            </>
          )}

          <div className="text-center text-sm leading-7 text-muted-foreground">
            <button className="font-medium text-foreground transition-colors hover:text-primary" onClick={() => setPage('login')} type="button">
              Back to sign in
            </button>
          </div>
        </div>
      </AuthCard>
    </AuthScaffold>
  );
}

function ResetPasswordPage({ setPage }) {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextToken = new URLSearchParams(window.location.search).get('token');
    if (nextToken) setToken(nextToken);
    else setError('Invalid reset link. Please request a new one.');
  }, []);

  const submit = async () => {
    if (pass !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (pass.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await apiCall('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password: pass }),
      });
      setMsg('Password reset successfully. You can now sign in with your new password.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      description="Choose a strong password and return to your account with the same polished flow."
      eyebrow="New password"
      highlights={[
        { icon: ShieldCheck, label: 'Hashed and protected' },
        { icon: KeyRound, label: 'Fresh credentials' },
        { icon: Clock3, label: 'Quick return to sign in' },
      ]}
      title="Set the new password and continue."
    >
      <AuthCard>
        <div className="space-y-5">
          {error && <Alert variant="error">{error}</Alert>}
          {msg ? (
            <>
              <Alert variant="success">{msg}</Alert>
              <Button className="w-full" onClick={() => setPage('login')} size="lg" type="button">
                Sign in now
              </Button>
            </>
          ) : (
            <>
              <FormField label="New password">
                <Input onChange={(e) => setPass(e.target.value)} placeholder="Minimum 8 characters" type="password" value={pass} />
              </FormField>
              <FormField label="Confirm password">
                <Input
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="Repeat your password"
                  type="password"
                  value={confirm}
                />
              </FormField>
              <Button className="w-full" disabled={loading || !token} onClick={submit} size="lg" type="button">
                {loading ? <LoaderLabel>Resetting password...</LoaderLabel> : 'Reset password'}
              </Button>
            </>
          )}
        </div>
      </AuthCard>
    </AuthScaffold>
  );
}

function VerifyEmailPage({ setPage }) {
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token. Please use the link from your email.');
      return;
    }

    apiCall(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((data) => {
        setStatus('success');
        setMessage(data.message || 'Email verified successfully.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message);
      });
  }, []);

  const statusMap = {
    verifying: {
      icon: LoaderCircle,
      iconClassName: 'animate-spin',
      title: 'Verifying your email.',
      copy: message || 'Please wait while we confirm your address.',
    },
    success: {
      icon: CheckCircle2,
      iconClassName: 'text-emerald-500',
      title: 'Email verified.',
      copy: message || 'You can now sign in.',
    },
    error: {
      icon: CircleAlert,
      iconClassName: 'text-red-500',
      title: 'Verification failed.',
      copy: message || 'The link may have expired.',
    },
  };

  const current = statusMap[status];
  const Icon = current.icon;

  return (
    <AuthScaffold
      description="We verify email addresses before account access so billing, notices, and recovery stay reliable."
      eyebrow="Email verification"
      highlights={[
        { icon: ShieldCheck, label: 'Verified contact point' },
        { icon: Mail, label: 'Reliable billing and recovery' },
        { icon: Sparkles, label: 'One clean step before sign in' },
      ]}
      title="Confirm the inbox before you continue."
    >
      <AuthCard>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Icon className={`size-8 ${current.iconClassName || ''}`} />
          </div>
          <div className="space-y-3">
            <Badge variant="outline">{status === 'verifying' ? 'Checking link' : 'Account status'}</Badge>
            <h2 className="font-display text-4xl leading-none tracking-tight text-foreground">
              {current.title}
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">{current.copy}</p>
          </div>

          {status !== 'verifying' && (
            <Button onClick={() => setPage('login')} size="lg" type="button">
              Back to sign in
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </div>
      </AuthCard>
    </AuthScaffold>
  );
}

export { AuthPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage };
export default AuthPage;
