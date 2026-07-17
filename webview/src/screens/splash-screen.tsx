import { LogoIcon } from '../components/logo-icon';
import { LoadingPulse } from '../components/ui/ld';
import './splash-screen.scss';

export function SplashScreen() {
  return (
    <div className="splash-screen">
      <LogoIcon size={32} />
      <LoadingPulse />
    </div>
  );
}
