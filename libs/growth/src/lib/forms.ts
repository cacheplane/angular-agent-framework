import type {
  ApproveContactFromFormInput,
  FormApprovalControlState,
} from './contacts.ts';
import { approveContactFromFormInTransaction } from './contacts.ts';
import type { EmailHmacKeyring } from './crypto.ts';
import type { SqlExecutor, SqlTransaction } from './database.ts';
import type { GrowthEmailClassification } from './models.ts';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type FormSubmission =
  | {
      kind: 'whitepaper';
      paper: 'overview' | 'angular' | 'render' | 'chat';
    }
  | { kind: 'newsletter' }
  | { kind: 'contact'; message?: string | null }
  | {
      kind: 'pricing';
      message?: string | null;
      pilotInterest?: 'yes' | 'maybe' | 'no' | null;
      teamSize?: '1-5' | '6-25' | '26-100' | '100+' | null;
      timeline?:
        | 'this_quarter'
        | 'next_quarter'
        | '6_plus_months'
        | 'exploring'
        | null;
    };

export interface AcceptFormSubmissionInput {
  submissionId: string;
  email: string;
  displayName?: string | null;
  companyName?: string | null;
  form: FormSubmission;
  source: string;
  sourceForm: string;
  noticeText: string;
  noticeVersion: string;
  policyVersion: string;
  acquisitionSessionId?: string | null;
  occurredAt: Date;
  keyring: EmailHmacKeyring;
  serverEmailClassification?: GrowthEmailClassification;
}

export interface AcceptFormSubmissionResult {
  accepted: true;
  approved: boolean;
  contactId: string;
  submissionId: string;
}

interface AcceptFormSubmissionDependencies {
  approveContact: (
    transaction: SqlTransaction,
    input: ApproveContactFromFormInput
  ) => Promise<FormApprovalControlState>;
}

const defaultDependencies: AcceptFormSubmissionDependencies = {
  approveContact: approveContactFromFormInTransaction,
};

function uuid(field: string, value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID_V4.test(normalized)) {
    throw new Error(`${field} must be a UUIDv4`);
  }
  return normalized;
}

function optionalText(
  field: string,
  value: string | null | undefined,
  maximumLength: number
): string | undefined {
  if (value == null) return undefined;
  const normalized = value.trim();
  if (normalized.length === 0) return undefined;
  if (normalized.length > maximumLength) {
    throw new Error(`${field} must not exceed ${maximumLength} characters`);
  }
  return normalized;
}

function submittedFacts(
  input: AcceptFormSubmissionInput,
  submissionId: string
): NonNullable<ApproveContactFromFormInput['submittedFacts']> {
  const acquisitionSessionId = input.acquisitionSessionId
    ? uuid('acquisitionSessionId', input.acquisitionSessionId)
    : undefined;
  const common = {
    ...(acquisitionSessionId
      ? { acquisition_session_id: acquisitionSessionId }
      : {}),
    form_kind: input.form.kind,
    submission_id: submissionId,
  } as const;

  switch (input.form.kind) {
    case 'whitepaper':
      return { ...common, paper: input.form.paper };
    case 'newsletter':
      return common;
    case 'contact': {
      const message = optionalText('message', input.form.message, 2_000);
      return { ...common, ...(message ? { message } : {}) };
    }
    case 'pricing': {
      const message = optionalText('message', input.form.message, 2_000);
      return {
        ...common,
        ...(message ? { message } : {}),
        ...(input.form.pilotInterest
          ? { pilot_interest: input.form.pilotInterest }
          : {}),
        ...(input.form.teamSize ? { team_size: input.form.teamSize } : {}),
        ...(input.form.timeline ? { timeline: input.form.timeline } : {}),
      };
    }
  }
}

export async function acceptFormSubmission(
  executor: SqlExecutor,
  input: AcceptFormSubmissionInput,
  dependencies: AcceptFormSubmissionDependencies = defaultDependencies
): Promise<AcceptFormSubmissionResult> {
  const submissionId = uuid('submissionId', input.submissionId);
  const facts = submittedFacts(input, submissionId);

  return executor.transaction(async (transaction) => {
    const contact = await dependencies.approveContact(transaction, {
      email: input.email,
      displayName: input.displayName,
      companyName: input.companyName,
      source: input.source,
      sourceForm: input.sourceForm,
      noticeText: input.noticeText,
      noticeVersion: input.noticeVersion,
      policyVersion: input.policyVersion,
      eventKey: `form:${submissionId}:accepted`,
      occurredAt: input.occurredAt,
      keyring: input.keyring,
      serverEmailClassification: input.serverEmailClassification,
      submittedFacts: facts,
    });
    const approved = contact.formApprovalGranted;
    const fulfillmentPayload = {
      form_kind: input.form.kind,
      ...(input.form.kind === 'whitepaper' ? { paper: input.form.paper } : {}),
      submission_id: submissionId,
    };

    const jobs = await transaction.execute<{ idempotency_key: string }>(
      `/* growth:enqueue-form-jobs */
       with requested(kind, idempotency_key, payload) as (
         select 'fulfill', 'form:' || $3 || ':fulfill', $5::jsonb
         union all
         select 'enrich', 'form:' || $3 || ':enrich',
                jsonb_build_object(
                  'form_kind', $6::text,
                  'submission_id', $3::text
                )
         where $4::boolean
         union all
         select 'notify', 'form:' || $3 || ':notify',
                jsonb_build_object(
                  'form_kind', $6::text,
                  'submission_id', $3::text
                )
         where $4::boolean
       ), inserted as (
         insert into growth_jobs (
           kind, contact_id, status, available_at, idempotency_key, payload
         )
         select kind, $1, 'pending', $2, idempotency_key, payload
         from requested
         on conflict (idempotency_key) do nothing
         returning idempotency_key
       )
       select idempotency_key from inserted
       union all
       select requested.idempotency_key
       from requested
       join growth_jobs existing
         on existing.idempotency_key = requested.idempotency_key
       where not exists (
               select 1 from inserted
               where inserted.idempotency_key = requested.idempotency_key
             )
         and existing.contact_id = $1
         and existing.kind = requested.kind
         and existing.payload = requested.payload`,
      [
        contact.contactId,
        input.occurredAt,
        submissionId,
        approved,
        JSON.stringify(fulfillmentPayload),
        input.form.kind,
      ]
    );
    const expectedJobs = approved ? 3 : 1;
    if (jobs.rows.length !== expectedJobs) {
      throw new Error(`Growth form job idempotency conflict: ${submissionId}`);
    }

    return {
      accepted: true,
      approved,
      contactId: contact.contactId,
      submissionId,
    };
  });
}
