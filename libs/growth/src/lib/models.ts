export type GrowthJobStatus =
  | 'pending'
  | 'leased'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type GrowthDeliveryStatus =
  | 'not_submitted'
  | 'submitted'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'failed'
  | 'unknown';

export type GrowthEmailClassification = 'work' | 'personal' | 'unknown';

export interface FormOutreachApprovedActivityData {
  email_classification: GrowthEmailClassification;
  policy_version: string;
  source: string;
  source_form: string;
  verification: 'server_verified';
}

export interface GrowthContact {
  id: string;
  emailNormalized: string | null;
  emailLookupHmac: string;
  emailHmacKeyVersion: number;
  displayName: string | null;
  companyName: string | null;
  companyDomain: string | null;
  outreachApprovedAt: Date | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface GrowthProject {
  id: string;
  contactId: string | null;
  posthogDistinctId: string;
  claimKeyHash: string;
  claimConsumedAt: Date | null;
  claimMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GrowthActivity {
  id: bigint;
  eventKey: string;
  contactId: string | null;
  projectId: string | null;
  kind: string;
  occurredAt: Date;
  data: Record<string, unknown>;
  createdAt: Date;
}

export interface GrowthJob {
  id: string;
  kind: string;
  contactId: string | null;
  projectId: string | null;
  status: GrowthJobStatus;
  availableAt: Date;
  leaseUntil: Date | null;
  leaseToken: string | null;
  attempts: number;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  providerEmailId: string | null;
  rfcMessageId: string | null;
  gmailSeedMessageId: string | null;
  deliveryStatus: GrowthDeliveryStatus;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GrowthArtifact {
  id: string;
  jobId: string;
  contactId: string | null;
  projectId: string | null;
  kind: string;
  schemaVersion: number;
  content: Record<string, unknown>;
  createdAt: Date;
}
