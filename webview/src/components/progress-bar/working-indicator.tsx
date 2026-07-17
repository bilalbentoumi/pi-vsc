import { useEffect, useRef, useState } from 'react';
import { LoadingPulse } from '../ui/ld';
import './progress-bar.scss';

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Live "Working" status shown while the agent turn is in progress. Mounts when
 * streaming starts and unmounts when it ends, so its timer measures the turn.
 */
export function ProgressBar() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="progress-bar" role="status" aria-live="polite">
      <LoadingPulse variant="march" size="md" className="progress-dots" />
      <span className="progress-label">Working</span>
      <span className="progress-time">{formatDuration(elapsed)}</span>
    </div>
  );
}
