import AuthRedirectHandler from '@/components/AuthRedirectHandler';
import LandingExperience from './preview/sky/LandingExperience';

export default function LandingPage() {
  return (
    <>
      <AuthRedirectHandler />
      <LandingExperience />
    </>
  );
}
