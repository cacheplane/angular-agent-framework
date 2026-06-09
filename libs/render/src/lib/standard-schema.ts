// SPDX-License-Identifier: MIT
// Vendored from the Standard Schema spec (https://standardschema.dev) — the
// spec is published expressly to be copied in rather than depended on. Zero
// runtime; types only. Lets a RenderViewEntry carry any spec-compliant
// validator (Zod/Valibot/ArkType) without a package dependency.
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }
  export type Result<Output> = SuccessResult<Output> | FailureResult;
  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }
  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }
  export interface PathSegment {
    readonly key: PropertyKey;
  }
  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
  export type InferInput<Schema extends StandardSchemaV1> =
    NonNullable<Schema['~standard']['types']>['input'];
  export type InferOutput<Schema extends StandardSchemaV1> =
    NonNullable<Schema['~standard']['types']>['output'];
}
