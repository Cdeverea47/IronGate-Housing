import React from 'react';

// A shield (protection) wrapped around a simple house glyph — fits "IronGate
// Housing" (secure, home-focused). Uses currentColor so it inherits whatever
// text color the parent sets (the app already renders on a white-on-gradient
// theme almost everywhere).
export function LogoMark({ className = 'h-5 w-5', style, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path
        d="M12 2.5L19 5.5V11.5C19 16.2 16 20 12 21.5C8 20 5 16.2 5 11.5V5.5L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 7.8L16.2 11.8H14.5V16.2H9.5V11.8H7.8L12 7.8Z" fill="currentColor" />
    </svg>
  );
}

export function LogoBadge({ size = 32, className = '' }) {
  return (
    <div
      className={`rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <LogoMark className="h-[58%] w-[58%]" />
    </div>
  );
}

// The wordmark: plain "IronGate Housing" text.
export function Wordmark({ className = '' }) {
  return <span className={`whitespace-nowrap ${className}`}>IronGate&nbsp;Housing</span>;
}
