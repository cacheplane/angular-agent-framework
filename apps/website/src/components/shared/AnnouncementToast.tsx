'use client';
import { useState, useEffect, useRef } from 'react';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import {
  FORM_POLICY_REFRESH_MESSAGE,
  growthFormRequestSnapshot,
  type GrowthFormRequestSnapshot,
} from '../../lib/growth/form-client';
import { analyticsEvents } from '../../lib/analytics/events';
import {
  track,
  trackWhitepaperDownloadClick,
} from '../../lib/analytics/client';
import { Button } from '../ui/Button';

/**
 * Bump this date to re-show the toast for all users.
 * Format: YYYY-MM-DD
 */
const ANNOUNCEMENT_DATE = '2026-04-07';
const STORAGE_KEY = `dismissed-announcement-${ANNOUNCEMENT_DATE}`;
const DELAY_MS = 30_000;

type Step = 'cta' | 'form' | 'sent' | 'stale';

export function AnnouncementToast({
  formPolicy,
}: {
  formPolicy: PublicFormPolicy;
}) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>('cta');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submissionSnapshot = useRef<GrowthFormRequestSnapshot<{
    email: string;
    paper: 'overview';
  }> | null>(null);
  const disclosureId = 'toast-whitepaper-growth-disclosure';

  const [timerDone, setTimerDone] = useState(false);
  const [scrolledEnough, setScrolledEnough] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    } catch {
      return;
    }
    const timer = setTimeout(() => setTimerDone(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Intent gate (spec 2026-08-31): the toast waits for BOTH the delay and a
  // 40% scroll depth — it should meet readers who are reading, not arrivals.
  useEffect(() => {
    if (scrolledEnough) return undefined;
    let raf = 0;
    const check = () => {
      raf = 0;
      const doc = document.documentElement;
      const denom = Math.max(1, doc.scrollHeight - window.innerHeight);
      if (window.scrollY / denom >= 0.4) {
        setScrolledEnough(true);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    check();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrolledEnough]);

  useEffect(() => {
    if (timerDone && scrolledEnough) setVisible(true);
  }, [timerDone, scrolledEnough]);

  useEffect(() => {
    if (visible) {
      // Next frame: flip mounted so the CSS transition runs from initial to final state.
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
    return undefined;
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    track(analyticsEvents.marketingWhitepaperSignupSubmit, {
      surface: 'toast',
      source_section: 'announcement-toast',
      paper: 'overview',
    });
    try {
      const snapshot = growthFormRequestSnapshot(submissionSnapshot.current, {
        email,
        paper: 'overview' as const,
      });
      submissionSnapshot.current = snapshot;
      const response = await fetch('/api/whitepaper-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...snapshot.facts,
          acquisition_session_id: snapshot.acquisition_session_id,
          submission_id: snapshot.submission_id,
          policy_version: formPolicy.version,
        }),
      });
      if (response.status === 409) {
        submissionSnapshot.current = null;
        setStep('stale');
        setSubmitting(false);
        return;
      }
      if (response.status >= 400 && response.status < 500) {
        submissionSnapshot.current = null;
      }
      submissionSnapshot.current = null;
      track(analyticsEvents.marketingWhitepaperSignupSuccess, {
        surface: 'toast',
        source_section: 'announcement-toast',
        paper: 'overview',
      });
    } catch {
      track(analyticsEvents.marketingWhitepaperSignupFail, {
        surface: 'toast',
        source_section: 'announcement-toast',
        paper: 'overview',
        error_reason: 'api_error',
      });
    }
    setStep('sent');
    setSubmitting(false);
    // Auto-dismiss after showing success
    setTimeout(dismiss, 4000);
  };

  if (!visible) return null;

  return (
    // Non-modal dialog, not role="alert": an alert/live region must not hold
    // interactive content (the CTA button and email form live here), and
    // assertive announcement of a marketing prompt is hostile. Focus is never
    // stolen on entry; Escape dismisses once focus is inside.
    <div
      role="dialog"
      aria-labelledby="toast-title"
      className="toast-root"
      data-announcement-toast=""
      data-mounted={mounted || undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape') dismiss();
      }}
    >
      {/* Dismiss button */}
      <button onClick={dismiss} aria-label="Dismiss" className="toast-close">
        ×
      </button>

      {/* Eyebrow */}
      <p className="toast-eyebrow">Free Guide</p>

      {/* Title */}
      <p id="toast-title" className="toast-title">
        From Prototype to Production
      </p>

      {step === 'cta' && (
        <>
          <p className="toast-cta-copy">
            Six production-readiness dimensions for Angular agents. Get the
            guide.
          </p>
          <div className="toast-button-row">
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                track(analyticsEvents.marketingCtaClick, {
                  surface: 'toast',
                  source_section: 'announcement-toast',
                  cta_id: 'toast_get_guide',
                });
                setStep('form');
              }}
            >
              ↓ Get the Guide
            </Button>
            <button onClick={dismiss} className="toast-not-now">
              Not now
            </button>
          </div>
        </>
      )}

      {step === 'form' && (
        <form onSubmit={handleSubmit} className="toast-mt-section">
          <label htmlFor="toast-email" className="sr-only">
            Email address
          </label>
          <input
            id="toast-email"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
            autoFocus
            className="toast-input"
          />
          <p id={disclosureId} className="toast-disclosure">
            {formPolicy.disclosures.whitepaper}
          </p>
          <div className="toast-button-row">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting || !email}
              aria-describedby={disclosureId}
            >
              {submitting ? 'Sending...' : '↓ Send me the guide'}
            </Button>
          </div>
          <a
            href="/whitepaper.pdf"
            download="angular-agent-readiness-guide.pdf"
            onClick={() => {
              trackWhitepaperDownloadClick('overview', {
                surface: 'toast',
                source_section: 'announcement-toast',
                cta_id: 'toast_direct_download',
              });
              dismiss();
            }}
            className="toast-download-link"
          >
            or download directly
          </a>
        </form>
      )}

      {step === 'stale' && (
        <div className="toast-mt-section" role="alert">
          <p className="toast-disclosure">{FORM_POLICY_REFRESH_MESSAGE}</p>
          <div className="toast-button-row">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => window.location.reload()}
            >
              Refresh page
            </Button>
          </div>
        </div>
      )}

      {step === 'sent' && (
        <div className="toast-mt-section">
          {/* role=status: the step swap is announced without stealing focus. */}
          <p role="status" className="toast-success-text">
            ✓ Check your inbox — the guide is on its way!
          </p>
        </div>
      )}
    </div>
  );
}
