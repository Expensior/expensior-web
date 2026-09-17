'use client';

export default function SegmentedTabs({
  tabs, active, onChange,
}: {
  tabs: [string, string][];
  active: string;
  onChange: (key: string) => void;
}) {
  const idx = Math.max(0, tabs.findIndex(([k]) => k === active));

  return (
    <div style={{ display: 'inline-flex', position: 'relative', background: 'color-mix(in srgb, var(--bg), transparent 50%)', borderRadius: 12, padding: 3 }}>
      <div
        style={{
          position: 'absolute', top: 3, left: 3, bottom: 3,
          width: 'calc(50% - 3px)', background: 'var(--accent)', borderRadius: 9,
          transform: `translateX(${idx * 100}%)`,
          transition: 'transform .25s cubic-bezier(.34,1.2,.64,1)',
        }}
      />
      {tabs.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            position: 'relative', minWidth: 108, textAlign: 'center', padding: '7px 14px',
            fontSize: 12, fontWeight: active === key ? 600 : 500,
            color: active === key ? 'var(--bg)' : 'var(--text)',
            background: 'none', border: 'none', cursor: 'pointer', zIndex: 1,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
