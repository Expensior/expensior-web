'use client';

import { useState } from 'react';

// Matches on prefix first (most natural for typeahead -- typing "sw"
// suggests "Swiggy"), then falls back to substring matches so something
// like "food" can still surface "Avatar Food Court". Within each group, the
// incoming `merchants` list is already frequency-ranked, so that ordering
// is preserved rather than re-sorted here.
function getMatches(input: string, merchants: string[], max = 5): string[] {
  const query = input.trim().toLowerCase();
  if (!query) return [];
  const prefixMatches: string[] = [];
  const substringMatches: string[] = [];
  for (const m of merchants) {
    const lower = m.toLowerCase();
    if (lower === query) continue; // no point suggesting exactly what's already typed
    if (lower.startsWith(query)) prefixMatches.push(m);
    else if (lower.includes(query)) substringMatches.push(m);
    if (prefixMatches.length >= max) break;
  }
  return [...prefixMatches, ...substringMatches].slice(0, max);
}

export default function MerchantAutocomplete({
  value,
  onChange,
  merchants,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  merchants: string[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const matches = focused ? getMatches(value, merchants) : [];

  return (
    <div className="relative flex-1 min-w-0">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={className}
        autoComplete="off"
      />
      {matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden">
          {matches.map((m) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(m); setFocused(false); }}
              className="w-full text-left px-3 py-2 text-sc-14 text-[var(--text)] hover:bg-[var(--bg)]/40 transition-colors"
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
