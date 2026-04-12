import { useRouter } from 'next/router';
import AuthStandalonePage from '../components/auth/AuthStandalonePage';

export default function LoginPage() {
  const router = useRouter();
  const initialSignupMode = router.query.trial ? 'trial' : 'full';

  return <AuthStandalonePage mode="login" audience="public" initialSignupMode={initialSignupMode} />;
}
