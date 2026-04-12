import Head from 'next/head';
import { useRouter } from 'next/router';
import AuthPage, {
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './AuthPage';
import { withReferral } from '../../lib/referral';

function getTitle(mode, audience) {
  if (mode === 'forgot-password') return 'Reset Password';
  if (mode === 'reset-password') return 'Create New Password';
  if (mode === 'verify-email') return 'Verify Email';
  if (audience === 'photographer') {
    return mode === 'login' ? 'Photographer Login' : 'Photographer Signup';
  }
  return mode === 'login' ? 'Public Login' : 'Public Signup';
}

export default function AuthStandalonePage({
  mode,
  audience = 'public',
  initialSignupMode = 'full',
}) {
  const router = useRouter();

  const goTo = (next) => {
    if (typeof window === 'undefined') return;

    if (next === 'dashboard' || next === 'payment') {
      sessionStorage.setItem('mqr_post_login_page', next);
      router.push('/');
      return;
    }

    if (next === 'studio') {
      router.push('/studio');
      return;
    }

    if (next === 'studio-billing') {
      router.push('/studio/billing');
      return;
    }

    if (next === 'forgot-password') {
      router.push(withReferral(audience === 'photographer' ? '/photographers/forgot-password' : '/forgot-password'));
      return;
    }

    if (next === 'login') {
      router.push(withReferral(audience === 'photographer' ? '/photographers/login' : '/login'));
      return;
    }

    if (next === 'signup') {
      router.push(withReferral(audience === 'photographer' ? '/photographers/signup' : '/signup'));
      return;
    }

    if (next === 'trial-signup') {
      router.push(withReferral('/signup?trial=1'));
      return;
    }

    router.push('/');
  };

  return (
    <>
      <Head>
        <title>{getTitle(mode, audience)}</title>
      </Head>

      {mode === 'forgot-password' ? (
        <ForgotPasswordPage setPage={goTo} />
      ) : mode === 'reset-password' ? (
        <ResetPasswordPage setPage={goTo} />
      ) : mode === 'verify-email' ? (
        <VerifyEmailPage setPage={goTo} />
      ) : (
        <AuthPage
          mode={mode}
          setPage={goTo}
          setUser={() => {}}
          initialSignupMode={initialSignupMode}
          audience={audience}
        />
      )}
    </>
  );
}
