# Threadplane Google mailbox poller

This owner-operated Apps Script runs in `brian@threadplane.ai`. It reads bounded Gmail History pages and processes at most 25 message IDs per invocation. Gmail documents History results as chronological in increasing `historyId`, so this ordering—not the undocumented order of `messages.list`—is the global oldest-first invariant. A durable source offset can resume a dense History page without skipping additions or exceeding the per-run message budget. The opaque page token is retained byte-for-byte until the interval drains, then the high-water mark advances monotonically. The next interval starts from the prior committed mark, providing one completed interval of overlap; server Gmail-ID deduplication makes the replay inert. It sends only normalized identifiers, addresses, reply references, timestamps, and a closed seed-verification value to Threadplane. It never requests or sends message bodies, snippets, subjects, attachments, or the raw `Authentication-Results` header.

The manifest uses the narrower `gmail.metadata` scope. The poller uses `users.history.list` with `historyTypes: messageAdded` and `users.messages.get` with `format: metadata`; it does not use Gmail search queries. Current Gmail documentation explicitly supports `gmail.metadata` for History listing. The other explicit scopes permit the HTTPS callback and installation of the every-minute trigger.

Each request uses a unique nonce and a strict millisecond epoch timestamp. `X-Threadplane-Signature` is `v1=` plus the unpadded base64url HMAC-SHA-256 of `timestamp + "\n" + nonce + "\n" + base64url(SHA-256(exact JSON bytes))`.

## Install and authorize

1. Deploy the website route at `/api/growth/replies/google` first. Configure its dedicated `GOOGLE_REPLY_HMAC_SECRET` with at least 32 random bytes. Do not reuse any Resend, database, or action-token secret.
2. Create a standalone Apps Script project while signed in as `brian@threadplane.ai`.
3. Copy `Code.gs` and `appsscript.json` into that project. In **Services**, confirm the Gmail API advanced service is enabled. A standard Google Cloud project also needs the Gmail API enabled in Cloud Console; Apps Script's default project enables it when the service is added.
4. In **Project Settings → Script Properties**, add:
   - `THREADPLANE_REPLY_ENDPOINT`: the production HTTPS route URL.
   - `THREADPLANE_REPLY_HMAC_SECRET`: the same dedicated secret as the website route.
   - Do not create or edit `THREADPLANE_REPLY_INITIALIZED`, `THREADPLANE_REPLY_HISTORY_CURSOR`, `THREADPLANE_REPLY_SCAN_STATE`, or `THREADPLANE_REPLY_RECOVERY_STATE`; the script owns them.
5. Before enabling campaign delivery, run `initializeThreadplaneMailbox` manually once. Review and grant the requested permissions. This explicit first-install action records the current Gmail History watermark and writes the durable initialized marker without reading or backfilling mailbox messages. It refuses to overwrite an existing initialization.
6. Run `setupTrigger` manually once. The function removes duplicate `pollThreadplaneMailbox` triggers and installs exactly one every-minute trigger.

Never paste the HMAC secret into source, logs, this README, or a test fixture outside the intentionally fake values in automated tests.

## Cursor loss and History recovery

The initialized marker distinguishes a deliberate first installation from lost production state. After initialization, a missing cursor is never silently replaced. A missing cursor or Gmail `History.list` 404 creates a durable recovery ID, posts a closed `recovery_required` event, and pauses campaign send/reconciliation leasing plus final provider submission on the server.

Recovery performs a bounded metadata-only `Messages.list` full scan, including spam and trash and using no Gmail search query, followed by chronological `History.list` catch-up from the baseline captured before the full scan. Each acknowledged message advances a durable offset. A missing/deleted message is posted as the closed `message_unavailable:not_found` fact and does not stall later mail; transient Gmail or Threadplane failures retain the checkpoint. If that baseline expires during a long full scan, the script captures a new baseline and restarts the full-scan/catch-up cycle under the same recovery ID and existing server pause. Only after one complete full scan and catch-up are acknowledged does the script post `recovery_completed`, establish the new watermark, and clear the pause.

Do not delete or hand-edit recovery properties to bypass this process. Investigate the corresponding closed recovery activity in Neon and let the next trigger resume. If the state is malformed, keep delivery disabled and repair it deliberately with an audited operator procedure; do not run the initializer again.

## Smoke test before campaign rollout

1. Keep campaign leasing disabled.
2. Send one allowlisted test campaign message through the real Resend delivery path so Brian is BCC'd and `X-Threadplane-Job-ID` is present.
3. In Gmail's raw-message metadata, confirm `Authentication-Results` reports aligned DKIM or DMARC for `threadplane.ai`. Then run `pollThreadplaneMailbox` manually and confirm the accepted job gains its Gmail seed and RFC Message-ID bindings. This real Resend/BCC/alignment check is a mandatory rollout gate; forged mail that merely claims Brian's From address is ignored.
4. Reply from the test recipient. Run the poller again (or wait for the trigger) and confirm `campaign.reply_received` clears approval and cancels pending automation without provider-suppressing the address.
5. Confirm Brian's ordinary Gmail reply addresses the recipient, and inspect the server activity/job data to verify no body, snippet, subject, or attachment data exists.
6. Confirm an endpoint failure leaves both cursor and scan state at the last acknowledged message and that the next successful run recovers with a fresh nonce. For a deliberately paginated or dense-page test interval, confirm the cursor advances only after the final chronological History page is acknowledged.
7. Before production leasing is enabled, exercise recovery in a non-production mailbox: force an expired test watermark, verify the server pause is recorded before the metadata-only full scan, and verify it clears only after full scan plus History catch-up acknowledgements. Task 11's Dawn worker must use the canonical growth lease/dispatch boundary so it cannot bypass this pause.

This real Workspace smoke test is a manual deployment gate; unit tests do not authorize Google or touch a mailbox.

## Disable or revoke

Delete the `pollThreadplaneMailbox` trigger in Apps Script before disabling the server endpoint. To fully revoke access, remove the script's access from the Google Account **Third-party apps & services** security page, delete the six Script Properties named above, and archive or delete the Apps Script project. Rotate the dedicated server secret if its confidentiality is in doubt.
