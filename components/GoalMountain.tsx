'use client';

import { useEffect, useRef } from 'react';

const RIDGE_PATH = 'M 0 58 L 40 38 L 65 48 L 95 22 L 120 32 L 150 8 L 180 25 L 210 15 L 240 35 L 270 45 L 290 55 L 300 58';

export default function GoalMountain({ progressPct }: { progressPct: number }) {
  const hikerRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const hiker = hikerRef.current;
    if (!hiker) return;
    hiker.style.offsetPath = `path('${RIDGE_PATH}')`;
    hiker.style.offsetDistance = '0%';
    hiker.style.transition = 'offset-distance 1s ease-out';
    const clamped = Math.max(0, Math.min(100, progressPct));
    const t = setTimeout(() => { hiker.style.offsetDistance = `${clamped}%`; }, 80);
    return () => clearTimeout(t);
  }, [progressPct]);

  return (
    <svg viewBox="0 0 300 68" style={{ width: '100%', height: 55, display: 'block' }}>
      <polygon
        points="0,58 35,30 60,42 90,12 115,26 150,0 175,20 200,10 225,32 255,20 280,40 300,58"
        style={{ fill: 'var(--positive)', opacity: 0.35 }}
      />
      <polygon
        points="0,58 40,38 65,48 95,22 120,32 150,8 180,25 210,15 240,35 270,45 290,55 300,58"
        style={{ fill: 'var(--accent)', opacity: 0.5 }}
      />
      <polygon points="140,10 150,8 160,16 148,14" style={{ fill: 'var(--text)', opacity: 0.85 }} />
      <polygon points="85,20 95,22 102,28 92,26" style={{ fill: 'var(--text)', opacity: 0.85 }} />
      <polygon points="8,58 14,44 20,58" style={{ fill: 'var(--bg)', opacity: 0.6 }} />
      <polygon points="278,58 284,46 290,58" style={{ fill: 'var(--bg)', opacity: 0.6 }} />
      <line x1="150" y1="8" x2="150" y2="-8" style={{ stroke: 'var(--text)', strokeWidth: 1.5 }} />
      <polygon points="150,-8 150,-1 163,-4.5" style={{ fill: 'var(--positive)' }} />
      <circle ref={hikerRef} r="5" style={{ fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 1.5 }} />
    </svg>
  );
}
