import { type CSSProperties } from 'react';
import './logo-text.scss';

export function LogoText() {
  return (
    <h1 className="logo-text" aria-label="Pintra">
      <span className="logo-word" aria-hidden="true">
        {'PINTRA'.split('').map((letter, i) => (
          <span
            key={i}
            className="logo-letter"
            style={{ '--i': i } as CSSProperties}>
            {letter}
          </span>
        ))}
      </span>
    </h1>
  );
}
