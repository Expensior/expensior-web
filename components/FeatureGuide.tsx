'use client';

import { useState } from 'react';
import {
  IconX, IconChevronLeft, IconChevronRight,
  IconPencil, IconMessageCircle,
  IconBook2, IconLayoutDashboard, IconRepeat, IconMail, IconRefresh,
  IconCamera, IconSparkles, IconShieldLock,
} from '@tabler/icons-react';

interface Slide {
  icon: any;
  title: string;
  body: string;
}

interface TierGuide {
  name: string;
  tagline: string;
  slides: Slide[];
  isSecurity?: boolean; // not a tier -- works the same regardless of what's unlocked
}

// Reflects the actual current build, not the original extension's roadmap.
// Worth knowing for anyone editing this later: Scan and Voice were the two
// features the ORIGINAL Chrome extension's own onboarding honestly labeled
// "coming soon" (isRoadmap: true) -- they were never actually built there.
// In this app both are real, working features. No isRoadmap-style flag
// exists here because nothing currently shown is a placeholder.
//
// Voice was removed from this guide (and disabled in EntryFab's hub, code
// kept commented out there) since it proved unreliable on both desktop and
// mobile browsers -- not worth advertising a feature that doesn't work
// consistently.
//
// Tier differentiation: each tier's card tints progressively stronger with
// the theme's OWN accent color (light -> medium -> full), computed via
// color-mix() on the existing CSS variables -- no hardcoded hex values, so
// this automatically looks right regardless of which of the 11 themes is
// active. The security section deliberately breaks the pattern (plain
// surface, dashed border, lock badge instead of a number) since it isn't a
// tier and shouldn't look like one.
const TIERS: TierGuide[] = [
  {
    name: 'Getting a feel',
    tagline: 'Manual entry, categories, weekly view',
    slides: [
      { icon: IconPencil, title: 'Quick add', body: 'Type a plain sentence like "₹450 swiggy lunch" and Expensior parses the amount, merchant, and category for you.' },
      { icon: IconMessageCircle, title: 'SMS and CSV import', body: 'Paste a bank SMS thread or upload a statement CSV, and review a batch of parsed transactions before anything is added.' },
      { icon: IconBook2, title: 'The ledger', body: 'A month-by-month view with search, filters, a live category split, and your biggest expense, most frequent category, and busiest day at a glance.' },
      { icon: IconLayoutDashboard, title: 'The dashboard', body: 'An overview of your spending patterns, trends, self-knowledge score, and goals — updated the moment you log something.' },
      { icon: IconRepeat, title: 'Recurring templates', body: 'Save something like rent or a subscription as a template, then log it again in one tap next month.' },
    ],
  },
  {
    name: 'Getting curious',
    tagline: 'Gmail import and subscription detection',
    slides: [
      { icon: IconMail, title: 'Gmail import', body: 'Connect Gmail and scan your inbox for transaction confirmations — reviewed and confirmed by you before anything is added.' },
      { icon: IconRefresh, title: 'Subscription detection', body: 'A dedicated scan looks specifically for renewal emails, so recurring charges you might have forgotten about surface on their own.' },
    ],
  },
  {
    name: 'Master of my domain',
    tagline: 'Receipt scan and AI-assisted categorization',
    slides: [
      { icon: IconCamera, title: 'Receipt scan', body: 'Snap or upload a photo of a receipt and Claude reads the merchant, amount, and date for you.' },
      { icon: IconSparkles, title: 'Smart categorization', body: 'When a merchant isn’t recognized, Claude assigns a category — and what it learns helps every Expensior user, not just you.' },
    ],
  },
  {
    name: 'Account and security',
    tagline: 'Works the same at every tier — not something you unlock',
    isSecurity: true,
    slides: [
      { icon: IconShieldLock, title: 'Two-factor authentication', body: 'In Settings under Security, tap "Set up 2FA", scan the QR code with an authenticator app like Google Authenticator, then enter the 6-digit code it shows you to confirm.' },
    ],
  },
];

// Progressively stronger tint of the theme's own accent color per tier --
// index 0/1/2 map to light/medium/full. Text flips to var(--bg) once the
// background gets dark enough, matching the same pairing already used
// throughout the app's accent-filled buttons.
function tierStyle(tier: TierGuide, tierIdx: number) {
  if (tier.isSecurity) {
    return {
      cardBg: 'var(--surface)',
      cardBorder: '1px dashed var(--border)',
      textColor: 'var(--text)',
      mutedColor: 'var(--muted)',
      iconCircleBg: 'color-mix(in srgb, var(--accent), var(--surface) 85%)',
      iconColor: 'var(--accent)',
      dotActive: 'var(--accent)',
      dotInactive: 'var(--border)',
      navTextColor: 'var(--muted)',
    };
  }
  const strength = [15, 55, 100][tierIdx] ?? 15; // % accent mixed into the card background
  const dark = tierIdx >= 1; // medium and full tiers get light text
  return {
    cardBg: `color-mix(in srgb, var(--accent), var(--surface) ${100 - strength}%)`,
    cardBorder: '1px solid var(--border)',
    textColor: dark ? 'var(--bg)' : 'var(--text)',
    mutedColor: dark ? 'color-mix(in srgb, var(--bg), transparent 25%)' : 'var(--muted)',
    iconCircleBg: dark ? 'color-mix(in srgb, var(--bg), transparent 85%)' : 'color-mix(in srgb, var(--accent), transparent 85%)',
    iconColor: dark ? 'var(--bg)' : 'var(--accent)',
    dotActive: dark ? 'var(--bg)' : 'var(--accent)',
    dotInactive: dark ? 'color-mix(in srgb, var(--bg), transparent 65%)' : 'var(--border)',
    navTextColor: dark ? 'color-mix(in srgb, var(--bg), transparent 30%)' : 'var(--muted)',
  };
}

export default function FeatureGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tierIdx, setTierIdx] = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);

  if (!open) return null;

  const tier = TIERS[tierIdx];
  const slide = tier.slides[slideIdx];
  const Icon = slide.icon;
  const isLast = tierIdx === TIERS.length - 1 && slideIdx === tier.slides.length - 1;
  const isFirst = tierIdx === 0 && slideIdx === 0;
  const style = tierStyle(tier, tierIdx);

  function next() {
    if (slideIdx < tier.slides.length - 1) {
      setSlideIdx(slideIdx + 1);
    } else if (tierIdx < TIERS.length - 1) {
      setTierIdx(tierIdx + 1);
      setSlideIdx(0);
    } else {
      onClose();
      setTimeout(() => { setTierIdx(0); setSlideIdx(0); }, 300);
    }
  }

  function back() {
    if (slideIdx > 0) {
      setSlideIdx(slideIdx - 1);
    } else if (tierIdx > 0) {
      setTierIdx(tierIdx - 1);
      setSlideIdx(TIERS[tierIdx - 1].slides.length - 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 relative transition-colors"
        style={{ background: style.cardBg, border: style.cardBorder }}
      >
        <button onClick={onClose} aria-label="Close feature guide" className="absolute top-4 right-4 opacity-70 hover:opacity-100" style={{ color: style.textColor }}>
          <IconX size={18} />
        </button>

        <div className="flex items-start justify-between mb-0.5 pr-8">
          <p className="text-sc-11 uppercase tracking-wide font-semibold" style={{ color: style.textColor }}>{tier.name}</p>
          {tier.isSecurity ? (
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--accent)' }}>
              <IconShieldLock size={12} style={{ color: 'var(--bg)' }} />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-sc-11 font-medium" style={{ border: `1.5px solid ${style.textColor}`, color: style.textColor }}>
              {tierIdx + 1}
            </div>
          )}
        </div>
        <p className="text-sc-12 mb-6" style={{ color: style.mutedColor }}>{tier.tagline}</p>

        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: style.iconCircleBg }}>
            <Icon size={28} style={{ color: style.iconColor }} />
          </div>
          <p className="text-sc-16 font-semibold mb-2" style={{ color: style.textColor }}>{slide.title}</p>
          <p className="text-sc-14 leading-relaxed" style={{ color: style.mutedColor }}>{slide.body}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 my-5">
          {TIERS.map((t, ti) =>
            t.slides.map((_, si) => (
              <span
                key={`${ti}-${si}`}
                className="rounded-full transition-all"
                style={{
                  width: ti === tierIdx && si === slideIdx ? 16 : 6,
                  height: 6,
                  background: ti === tierIdx && si === slideIdx ? style.dotActive : style.dotInactive,
                }}
              />
            ))
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={back}
            disabled={isFirst}
            className="flex items-center gap-1 text-sc-13 disabled:opacity-0 transition-opacity"
            style={{ color: style.navTextColor }}
          >
            <IconChevronLeft size={16} /> Back
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-sc-13 font-medium"
            style={{
              background: style.textColor === 'var(--bg)' ? 'var(--bg)' : 'var(--accent)',
              color: style.textColor === 'var(--bg)' ? 'var(--accent)' : 'var(--bg)',
            }}
          >
            {isLast ? 'Done' : 'Next'} {!isLast && <IconChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
