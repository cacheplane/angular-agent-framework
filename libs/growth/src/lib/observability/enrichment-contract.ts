/** Internal evidence reference for a later Dawn adapter; never a public collection payload. */
export type ObservationEnrichmentReference =
  | {
      subjectId: string;
      evaluatedAt: string;
      status: 'not_requested' | 'pending' | 'failed';
    }
  | {
      subjectId: string;
      evaluatedAt: string;
      status: 'available';
      artifactId: string;
      artifactSchemaVersion: number;
      applicableObservationIds: readonly string[];
      sourceIds: readonly string[];
    };
