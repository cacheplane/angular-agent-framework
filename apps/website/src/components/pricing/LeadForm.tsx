'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section id="lead-form" className="px-8 py-16 max-w-xl mx-auto">
      <p
        className="font-mono text-xs uppercase tracking-widest mb-8 text-center"
        style={{ color: '#6C8EFF' }}
      >
        Enterprise
      </p>
      <h2
        style={{
          fontFamily: 'var(--font-garamond)',
          fontWeight: 700,
          fontSize: 'clamp(24px, 3vw, 36px)',
          color: '#EEF1FF',
          textAlign: 'center',
          marginBottom: 32,
        }}
      >
        Need volume seats or a custom contract?
      </h2>

      {status === 'sent' ? (
        <p className="text-center text-muted-foreground">
          Thanks — we&apos;ll be in touch within one business day.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-name">Name</Label>
            <Input id="lead-name" name="name" placeholder="Name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-email">Work email</Label>
            <Input id="lead-email" name="email" type="email" placeholder="Work email" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-company">Company</Label>
            <Input id="lead-company" name="company" placeholder="Company" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-message">Use case</Label>
            <Textarea
              id="lead-message"
              name="message"
              placeholder="Tell us about your use case"
              rows={4}
            />
          </div>
          <Button type="submit" disabled={status === 'sending'} className="w-full mt-2">
            {status === 'sending' ? 'Sending…' : 'Get in touch'}
          </Button>
          {status === 'error' && (
            <p className="text-sm text-center" style={{ color: '#FF6B6B' }}>
              Something went wrong — try again or email us directly.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
