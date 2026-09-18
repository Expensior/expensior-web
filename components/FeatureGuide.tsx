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

// Progressively stronger tint of the theme's own accent color, applied ONLY
// to small, non-text-bearing elements (the badge, the icon circle) -- never
// to the card background itself. Earlier version tinted the whole card and
// kept var(--text)/var(--muted) for the label and tagline, which looked
// fine in isolation but was never actually tested against a COMPUTED tint
// background -- confirmed broken (washed-out, low-contrast text) across
// three different themes via screenshots. Card background now always stays
// on var(--bg), the one background var(--text)/var(--muted) are actually
// proven to contrast against everywhere else in the app.
function tierStyle(tier: TierGuide, tierIdx: number) {
  if (tier.isSecurity) {
    return {
      badgeBg: 'var(--accent)',
      badgeBorder: 'none',
      iconCircleBg: 'color-mix(in srgb, var(--accent), var(--surface) 85%)',
      iconColor: 'var(--accent)',
      dotActive: 'var(--accent)',
      dotInactive: 'var(--border)',
    };
  }
  const strength = [15, 55, 100][tierIdx] ?? 15;
  return {
    badgeBg: strength >= 100 ? 'var(--accent)' : 'transparent',
    badgeBorder: strength >= 100 ? 'none' : `1.5px solid color-mix(in srgb, var(--accent), var(--border) ${100 - strength}%)`,
    iconCircleBg: `color-mix(in srgb, var(--accent), var(--surface) ${100 - strength}%)`,
    iconColor: strength >= 100 ? 'var(--bg)' : 'var(--accent)',
    dotActive: 'var(--accent)',
    dotInactive: 'var(--border)',
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
      <div className="w-full max-w-sm bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-6 relative">
        <button onClick={onClose} aria-label="Close feature guide" className="absolute top-4 right-4 text-[var(--muted)] hover:text-[var(--text)]">
          <IconX size={18} />
        </button>

        <div className="flex items-start justify-between mb-0.5 pr-8">
          <p className="text-sc-11 uppercase tracking-wide font-semibold text-[var(--accent)]">{tier.name}</p>
          {tier.isSecurity ? (
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: style.badgeBg }}>
              <IconShieldLock size={12} style={{ color: 'var(--bg)' }} />
            </div>
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-sc-11 font-medium"
              style={{
                background: style.badgeBg,
                border: style.badgeBorder,
                color: style.badgeBg === 'var(--accent)' ? 'var(--bg)' : 'var(--accent)',
              }}
            >
              {tierIdx + 1}
            </div>
          )}
        </div>
        <p className="text-sc-12 text-[var(--muted)] mb-6">{tier.tagline}</p>

        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: style.iconCircleBg }}>
            <Icon size={28} style={{ color: style.iconColor }} />
          </div>
          <p className="text-sc-16 font-semibold text-[var(--text)] mb-2">{slide.title}</p>
          <p className="text-sc-14 text-[var(--muted)] leading-relaxed">{slide.body}</p>
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
            className="flex items-center gap-1 text-sc-13 text-[var(--muted)] disabled:opacity-0 hover:text-[var(--text)] transition-colors"
          >
            <IconChevronLeft size={16} /> Back
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1 bg-[var(--accent)] text-[var(--bg)] rounded-lg px-4 py-2 text-sc-13 font-medium"
          >
            {isLast ? 'Done' : 'Next'} {!isLast && <IconChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
