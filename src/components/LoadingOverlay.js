import React from 'react';

export default function LoadingOverlay({ text = 'Loading…' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 marble-overlay"></div>
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="loader-gold" aria-hidden></div>
        <div className="font-cinzel text-gold tracking-wider">{text}</div>
      </div>
    </div>
  );
}
