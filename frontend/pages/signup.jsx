import { useRouter } from 'next/router';
import AuthStandalonePage from '../components/auth/AuthStandalonePage';

export default function SignupPage() {
  const router = useRouter();
  const initialSignupMode = router.query.trial ? 'trial' : 'full';

  return <AuthStandalonePage mode="signup" audience="public" initialSignupMode={initialSignupMode} />;
}
