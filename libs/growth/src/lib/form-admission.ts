import { createHmac } from 'node:crypto';
import { normalizeRecipientEmail } from './crypto.ts';
import type { SqlTransaction } from './database.ts';
import type {
  AcceptFormSubmissionInput,
  AcceptFormSubmissionResult,
} from './forms.ts';
import { assessFormAbuse, type FormAbuseAssessment } from './form-abuse.ts';

export class FormRateLimitError extends Error {
  constructor(readonly retryAfterSec: number) {
    super('Form submission rate limited');
    this.name = 'FormRateLimitError';
  }
}

export interface FormAdmission {
  assessment: FormAbuseAssessment;
  requestDigest: string;
  limiterUnavailable: boolean;
  replay?: AcceptFormSubmissionResult;
}

function canonical(value: unknown): string {
  function sorted(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sorted);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, sorted(v)])
      );
    return value;
  }
  return JSON.stringify(sorted(value));
}

export async function prepareFormAdmission(
  tx: SqlTransaction,
  input: AcceptFormSubmissionInput
): Promise<FormAdmission> {
  const email = normalizeRecipientEmail(input.email);
  const digest = (secret: string | Uint8Array, value: string) =>
    createHmac('sha256', secret).update(value).digest('hex');
  const request = canonical({
    email,
    name: input.displayName?.trim() || null,
    company: input.companyName?.trim() || null,
    form: input.form,
    source: input.source,
    sourceForm: input.sourceForm,
    noticeText: input.noticeText,
    noticeVersion: input.noticeVersion,
    policyVersion: input.policyVersion,
    session: input.acquisitionSessionId || null,
    honeypot: input.honeypot?.trim() || null,
  });
  const requestDigest = digest(
    input.keyring.active.secret,
    `form-request:${request}`
  );
  const eventKey = `form:${input.submissionId}:assessment`;
  await tx.execute(
    '/* growth:lock-form-submission */ select pg_advisory_xact_lock(hashtextextended($1, 0))',
    [eventKey]
  );
  await tx.execute(
    '/* growth:lock-form-email */ select pg_advisory_xact_lock(hashtextextended($1, 0))',
    [email]
  );
  const prior = await tx.execute<{ data: Record<string, unknown> }>(
    '/* growth:read-form-assessment */ select data from growth_activity where event_key = $1',
    [eventKey]
  );
  if (prior.rows[0]) {
    const data = prior.rows[0].data;
    const key = [input.keyring.active, ...(input.keyring.previous ?? [])].find(
      (k) => k.version === data['key_version']
    );
    if (
      !key ||
      digest(key.secret, `form-request:${request}`) !== data['request_digest']
    ) {
      throw new Error('Form submission identity conflict');
    }
    return {
      assessment: data['assessment'] as FormAbuseAssessment,
      replay: data['result'] as AcceptFormSubmissionResult,
      requestDigest,
      limiterUnavailable: data['limiter_unavailable'] === true,
    };
  }
  const history = await tx.execute<{
    display_name: string | null;
    company_name: string | null;
  }>(
    `/* growth:read-form-history */
     select a.data->>'display_name' display_name, a.data->>'company_name' company_name
     from growth_activity a join growth_contacts c on c.id = a.contact_id
     where c.email_normalized = $1 and a.kind = 'contact.form_submission'
       and a.occurred_at >= $2::timestamptz - interval '1 minute'
       and a.occurred_at <= $2 and a.data->>'submission_id' <> $3
     order by a.occurred_at desc limit 10`,
    [email, input.occurredAt, input.submissionId]
  );
  const name = input.displayName?.trim();
  const company = input.companyName?.trim();
  const rapidIdentityChange = Boolean(
    name &&
      company &&
      history.rows.some(
        (row) =>
          row.display_name &&
          row.company_name &&
          row.display_name !== name &&
          row.company_name !== company
      )
  );
  const assessment = assessFormAbuse({
    email,
    displayName: name,
    companyName: company,
    message: 'message' in input.form ? input.form.message : undefined,
    honeypot: input.honeypot,
    rapidIdentityChange,
  });

  // Accepted legacy retries predate assessment records. Their existing immutable
  // ledger validates facts later, but they must not spend another budget slot.
  const legacy = await tx.execute<{ event_key: string }>(
    "/* growth:read-legacy-form-retry */ select event_key from growth_activity where event_key = $1 and kind = 'contact.form_submission'",
    [`form:${input.submissionId}:accepted`]
  );
  let limiterUnavailable = false;
  if (!legacy.rows.length) {
    const now = input.occurredAt.getTime();
    const window = new Date(Math.floor(now / 3_600_000) * 3_600_000);
    const buckets = [
      {
        key: `form:email:${digest(
          input.keyring.active.secret,
          `form-email:${email}`
        )}`,
        limit: 5,
      },
    ];
    if (input.trustedClientIp)
      buckets.push({
        key: `form:ip:${digest(
          input.keyring.active.secret,
          `form-ip:${input.trustedClientIp}`
        )}`,
        limit: 20,
      });
    await tx.execute('savepoint growth_form_budget');
    try {
      for (const bucket of buckets.sort((a, b) => a.key.localeCompare(b.key))) {
        const count = await tx.execute<{ count: string | number }>(
          `/* growth:consume-form-budget */
           insert into growth_collection_budgets(bucket_key, window_start, count) values($1,$2,1)
           on conflict(bucket_key,window_start) do update set count=growth_collection_budgets.count+1 returning count`,
          [bucket.key, window]
        );
        if (!count.rows[0]) throw new Error('Form budget unavailable');
        if (Number(count.rows[0].count) > bucket.limit)
          throw new FormRateLimitError(
            Math.max(1, Math.ceil((window.getTime() + 3_600_000 - now) / 1000))
          );
      }
      await tx.execute(
        `/* growth:expire-form-budgets */
        delete from growth_collection_budgets where (bucket_key,window_start) in
        (select bucket_key,window_start from growth_collection_budgets where bucket_key like 'form:%'
         and window_start < $1::timestamptz - interval '1 day' limit 100)`,
        [window]
      );
      await tx.execute('release savepoint growth_form_budget');
    } catch (error) {
      await tx.execute('rollback to savepoint growth_form_budget');
      await tx.execute('release savepoint growth_form_budget');
      if (error instanceof FormRateLimitError) throw error;
      limiterUnavailable = true;
    }
  }
  return { assessment, requestDigest, limiterUnavailable };
}

export async function recordFormAdmission(
  tx: SqlTransaction,
  input: AcceptFormSubmissionInput,
  admission: FormAdmission,
  result: AcceptFormSubmissionResult
): Promise<void> {
  await tx.execute(
    `/* growth:record-form-assessment */
    insert into growth_activity(event_key,contact_id,kind,occurred_at,data)
    values($1,$2,'form.abuse_assessed',$3,$4::jsonb)`,
    [
      `form:${input.submissionId}:assessment`,
      result.contactId,
      input.occurredAt,
      JSON.stringify({
        assessment: admission.assessment,
        result,
        submission_id: input.submissionId,
        request_digest: admission.requestDigest,
        key_version: input.keyring.active.version,
        limiter_unavailable: admission.limiterUnavailable,
      }),
    ]
  );
}
