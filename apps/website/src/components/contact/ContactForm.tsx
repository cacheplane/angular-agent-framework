'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { analyticsEvents } from '../../lib/analytics/events';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { FORM_POLICY_REFRESH_MESSAGE } from '../../lib/growth/form-client';
import {
  Field,
  FormStatus,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
  emailError,
  requiredError,
  useGrowthForm,
} from '../form';

export type ContactIntent = 'contact' | 'enterprise';

const TIMELINES = [
  ['this_quarter', 'This quarter'],
  ['next_quarter', 'Next quarter'],
  ['6_plus_months', '6+ months'],
  ['exploring', 'Just exploring'],
] as const;

type Timeline = (typeof TIMELINES)[number][0];

interface ContactFormProps {
  formPolicy: PublicFormPolicy;
  /** `enterprise` adds the timeline field and posts the pricing form kind. */
  intent?: ContactIntent;
  /** The CTA that brought the visitor here; reported to analytics. */
  entryPoint?: string;
}

const FOUNDER_EMAIL = 'brian@threadplane.ai';

export function ContactForm({ formPolicy, intent = 'contact', entryPoint }: ContactFormProps) {
  const enterprise = intent === 'enterprise';
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [timeline, setTimeline] = useState<Timeline | ''>('');
  const [message, setMessage] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [companyMessage, setCompanyMessage] = useState<string | null>(null);
  const [timelineMessage, setTimelineMessage] = useState<string | null>(null);

  const form = useGrowthForm({
    route: '/api/leads',
    formPolicy,
    events: {
      submit: analyticsEvents.marketingLeadFormSubmit,
      success: analyticsEvents.marketingLeadFormSuccess,
      fail: analyticsEvents.marketingLeadFormFail,
    },
    analytics: {
      surface: enterprise ? 'pricing' : 'contact',
      source_section: 'contact-form',
      ...(entryPoint ? { entry_point: entryPoint } : {}),
    },
  });
  const disclosureId = 'contact-form-growth-disclosure';
  const companyError = 'Tell us the company so we can prepare.';
  const timelineError = 'Choose a timeline so we can route this.';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const emailProblem = emailError(email);
    const companyProblem = enterprise ? requiredError(company, companyError) : null;
    const timelineProblem = enterprise ? requiredError(timeline, timelineError) : null;
    setEmailMessage(emailProblem);
    setCompanyMessage(companyProblem);
    setTimelineMessage(timelineProblem);
    if (emailProblem) {
      document.getElementById('contact-email')?.focus();
      return;
    }
    if (companyProblem) {
      document.getElementById('contact-company')?.focus();
      return;
    }
    if (timelineProblem) {
      document.getElementById('contact-timeline')?.focus();
      return;
    }
    void form.submit({
      form_kind: enterprise ? 'pricing' : 'contact',
      email: email.trim(),
      ...(name.trim() ? { name: name.trim() } : {}),
      ...(company.trim() ? { company: company.trim() } : {}),
      ...(enterprise && timeline ? { timeline } : {}),
      ...(message.trim() ? { message: message.trim() } : {}),
    });
  }

  if (form.status === 'stale') {
    return (
      <FormStatus tone="stale" title="This page is out of date." detail={FORM_POLICY_REFRESH_MESSAGE}>
        <Button type="button" variant="primary" size="lg" onClick={() => window.location.reload()}>
          Refresh page
        </Button>
      </FormStatus>
    );
  }

  if (form.status === 'sent') {
    return <FormStatus tone="success" title="Sent." detail="Expect a reply within one business day." />;
  }

  return (
    <form onSubmit={handleSubmit} data-ui="form" noValidate>
      <Field id="contact-email" label="Work email" error={emailMessage}>
        <TextInput
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailMessage) setEmailMessage(emailError(e.target.value));
          }}
          onBlur={() => setEmailMessage(emailError(email))}
        />
      </Field>
      <Field id="contact-name" label="Name" optional>
        <TextInput type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field id="contact-company" label="Company" optional={!enterprise} error={companyMessage}>
        <TextInput
          type="text"
          autoComplete="organization"
          value={company}
          onChange={(e) => {
            setCompany(e.target.value);
            if (companyMessage) setCompanyMessage(requiredError(e.target.value, companyError));
          }}
        />
      </Field>
      {enterprise ? (
        <Field id="contact-timeline" label="Timeline" error={timelineMessage}>
          <Select
            value={timeline}
            onChange={(e) => {
              setTimeline(e.target.value as Timeline | '');
              if (timelineMessage) setTimelineMessage(requiredError(e.target.value, timelineError));
            }}
          >
            <option value="" disabled>
              Select…
            </option>
            {TIMELINES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field id="contact-message" label={enterprise ? 'Tell us about your use case' : 'What are you shipping?'} optional>
        <TextArea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <p id={disclosureId} data-ui="form-disclosure">
        {formPolicy.disclosures.contact}
      </p>
      <SubmitButton
        variant="primary"
        size="lg"
        pending={form.status === 'pending'}
        pendingLabel="Sending…"
        aria-describedby={disclosureId}
      >
        {enterprise ? 'Request a conversation' : 'Send to Brian'}
      </SubmitButton>
      {form.status === 'failed' ? (
        <FormStatus tone="failure" title="That did not send." detail={<>Email <a href={`mailto:${FOUNDER_EMAIL}`}>{FOUNDER_EMAIL}</a> instead, or try again.</>} />
      ) : null}
    </form>
  );
}
