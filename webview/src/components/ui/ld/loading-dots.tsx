import './loading-dots.scss';

export type LoadingDotsVariant = 'pulse' | 'march' | 'bounce' | 'coin';
export type LoadingDotsSize = 'sm' | 'md' | 'lg';

export interface LoadingDotsProps {
  variant?: LoadingDotsVariant;
  size?: LoadingDotsSize;
  className?: string;
}

export function LoadingPulse({
  variant = 'pulse',
  size = 'md',
  className,
}: LoadingDotsProps) {
  const classes = ['ld', `ld-${variant}`, `ld-${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span role="status" aria-label="Loading" className={classes}>
      <span className="ld-dot" />
      <span className="ld-dot" />
      <span className="ld-dot" />
    </span>
  );
}
