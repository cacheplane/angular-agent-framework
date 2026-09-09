# Mastra interrupt verification

The reservation tests exercise both Approve and Cancel through the browser,
check the correlated resume command and backend tool result, and assert that
the visible assistant reply agrees with that result.

Run the full suite with aimock replay:

```sh
npx nx e2e cockpit-runtimes-mastra-angular
```

To verify the same decisions against the live model through aimock, configure
`OPENAI_API_KEY` in the environment and run:

```sh
AIMOCK_MODE=record AIMOCK_RECORD_DIR=/tmp/mastra-approve-recordings \
  npx nx e2e cockpit-runtimes-mastra-angular --grep='Approve sends'
AIMOCK_MODE=record AIMOCK_RECORD_DIR=/tmp/mastra-cancel-recordings \
  npx nx e2e cockpit-runtimes-mastra-angular --grep='Cancel sends'
```

Use a fresh process for each decision. Aimock caches newly recorded responses
in memory, and its generated matchers do not distinguish these two tool-result
payloads. Running both decisions in one recording process can reuse the first
decision's reply instead of verifying the second against the live model.

Record mode forwards unmatched model requests to the provider and captures responses.
The campsite tool remains local: it returns a synthetic confirmation or decline
and does not make an external reservation. Each run uses a fresh local database.

Keep approval and cancellation continuation fixtures separate using
`toolResultContains`. Matching only the user prompt and `hasToolResult` can
replay an approval after a cancellation because both decisions share the same
prompt. The initial reservation fixture excludes tool results, so an unknown
continuation cannot restart the tool call silently.

The cancellation reply was captured from `gpt-4o-mini` through aimock record
mode on 2026-09-09, then given a stable tool-result matcher for replay.

Review captures before incorporating them into fixtures. Retain stable outcome
matchers rather than generated tool-call IDs, and do not commit credentials or
raw browser traces.
