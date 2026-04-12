import AuthStandalonePage from '../components/auth/AuthStandalonePage';

export default function VerifyEmailRoute() {
  return <AuthStandalonePage audience="public" mode="verify-email" />;
}
