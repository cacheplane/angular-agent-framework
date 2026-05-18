# Event & Property Taxonomy — Cacheplane

> Single source of truth for PostHog event names, properties, CTA ids, and surface ids. Implementation lands in `apps/website/src/lib/analytics/events.ts`, `apps/cockpit/src/lib/analytics/events.ts`, and `libs/telemetry/src/shared/events.ts`. Whenever those files change, this file changes.

## Namespace rules

Single PostHog project. Three event-name prefixes:

| Prefix       | Source                        | Notes                                                                                                    |
| ------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `marketing:` | `apps/website`                | Carried forward from May-2 instrumentation plan.                                                         |
| `cockpit:`   | `apps/cockpit`                | Activation surface. New in Spec 1.                                                                       |
| `ngaf:`      | `libs/telemetry`              | Library telemetry. Opt-out node, opt-in browser.                                                         |
| `docs:`      | `apps/website` (docs surface) | Subset of website events scoped to docs interactions. Distinguished by prefix for filtering convenience. |

The standard PostHog `$pageview` event is used as-is across all three surfaces.

## Naming rules

- lowercase snake_case after the prefix (`marketing:lead_form_submit`, not `marketing:LeadFormSubmit`).
- Static event names. Vary via properties, not event names.
- One event per discrete user action. Submits, successes, failures are distinct events.
- Server-side events for conversion truth; client-side for journey signal.

## Marketing (website)

| Event                                 | When                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `$pageview`                           | Automatic, every route                                                                        |
| `marketing:cta_click`                 | Any tracked CTA                                                                               |
| `marketing:external_link_click`       | External outbound (github, npm, cockpit)                                                      |
| `marketing:whitepaper_download_click` | Direct PDF download click                                                                     |
| `marketing:whitepaper_signup_submit`  | Submit attempt                                                                                |
| `marketing:whitepaper_signup_success` | Server 2xx                                                                                    |
| `marketing:whitepaper_signup_fail`    | Server non-2xx or validation error                                                            |
| `marketing:lead_form_submit`          | Submit attempt (any surface)                                                                  |
| `marketing:lead_form_success`         | Server 2xx                                                                                    |
| `marketing:lead_form_fail`            | Server non-2xx                                                                                |
| `marketing:lead_qualified`            | Server-side enrichment passes (qualified-lead def)                                            |
| `marketing:newsletter_signup_submit`  | Submit attempt                                                                                |
| `marketing:newsletter_signup_success` | Server 2xx                                                                                    |
| `marketing:newsletter_signup_fail`    | Failure                                                                                       |
| `docs:search_submit`                  | Docs search invocation                                                                        |
| `docs:search_result_click`            | Result click                                                                                  |
| `docs:copy_prompt_click`              | Prompt-copy button                                                                            |
| `docs:copy_code_click`                | Code-copy button                                                                              |
| `blog:cta_click`                      | Tracked CTA inside a blog post body. Props: `surface: 'blog'`, `cta_id?`, `destination_url?`. |
| `blog:copy_code_click`                | Copy-button click on a code block inside a blog post. Props: `surface: 'blog'`, `code_lang?`. |
| `docs:tab_select`                     | MDX tab change                                                                                |
| `docs:sidebar_section_toggle`         | Sidebar nav toggle                                                                            |

## Cockpit (activation surface)

| Event                                   | When                                                            |
| --------------------------------------- | --------------------------------------------------------------- |
| `cockpit:recipe_opened`                 | Sidebar capability link clicked                                 |
| `cockpit:mode_switched`                 | Run/Code/Docs/API tab change                                    |
| `cockpit:code_copied`                   | Copy click in code mode, doc snippet, or agentic-prompt block   |
| `cockpit:transport_connected`           | LangGraph/AG-UI/custom adapter wired in iframe                  |
| `cockpit:chat_first_message`            | First user message sent in cockpit chat                         |
| `cockpit:thread_persisted`              | Thread saved (re-load demonstrated)                             |
| `cockpit:interrupt_handled`             | Human-approval interrupt completed                              |
| `cockpit:generative_component_rendered` | One generative Angular component rendered                       |
| `cockpit:activation_complete`           | All five activation signals fired within 30 min for one session |

The five activation signals (whose union fires `cockpit:activation_complete`) are
`transport_connected`, `chat_first_message`, `thread_persisted`, `interrupt_handled`,
and `generative_component_rendered`. The shell events (`recipe_opened`,
`mode_switched`, `code_copied`) are context for the funnel — they fire before
or alongside the activation signals but are not part of the five-step rollup.
`ngaf:postinstall` is a separate top-of-funnel chart, uncorrelated to cockpit
sessions by design.

## ngaf (library telemetry)

| Event                           | When                                                       | Surface        | Default                                    |
| ------------------------------- | ---------------------------------------------------------- | -------------- | ------------------------------------------ |
| `ngaf:postinstall`              | Dependency/global install of a published `@ngaf/*` package | Node (script)  | **Opt-out**                                |
| `ngaf:runtime_instance_created` | Runtime adapter init                                       | Node / Browser | **Opt-out** on Node, **Opt-in** in Browser |
| `ngaf:runtime_request_created`  | Runtime adapter request created                            | Node / Browser | **Opt-out** on Node, **Opt-in** in Browser |
| `ngaf:stream_started`           | Stream begins                                              | Node / Browser | **Opt-out** on Node, **Opt-in** in Browser |
| `ngaf:stream_ended`             | Stream ends normally                                       | Node / Browser | **Opt-out** on Node, **Opt-in** in Browser |
| `ngaf:stream_errored`           | Stream errors                                              | Node / Browser | **Opt-out** on Node, **Opt-in** in Browser |
| `ngaf:browser_provided`         | `provideNgafTelemetry({enabled:true})`                     | Browser        | **Opt-in**                                 |
| `ngaf:browser_chat_init`        | Browser chat surface initialized                           | Browser        | **Opt-in**                                 |

Browser events never fire unless the consumer explicitly opts in. See `libs/telemetry/README.md` for the trust contract.

### `ngaf:postinstall` properties

| Property                       | Type   | Notes                                                                              |
| ------------------------------ | ------ | ---------------------------------------------------------------------------------- |
| `pkg`                          | string | Published `@ngaf/*` package name.                                                  |
| `version`                      | string | Published package version.                                                         |
| `node`                         | string | Current `process.version`; kept for existing dashboards.                           |
| `node_version`                 | string | Current `process.version`.                                                         |
| `os`                           | string | Current `process.platform`.                                                        |
| `arch`                         | string | Current `process.arch`.                                                            |
| `install_context`              | enum   | `ci`, `dependency`, `global`, or `workspace`; dashboards exclude `ci` defensively. |
| `package_manager`              | string | Parsed from npm's package-manager user agent when available.                       |
| `package_manager_version`      | string | Parsed from npm's package-manager user agent when available.                       |
| `package_manager_node_version` | string | Installer-reported Node version when available.                                    |
| `package_manager_os`           | string | Installer-reported OS token when available.                                        |
| `package_manager_arch`         | string | Installer-reported architecture token when available.                              |
| `package_manager_workspaces`   | bool   | Installer-reported workspace flag when available.                                  |
| `global_install`               | bool   | Whether npm reports a global install.                                              |
| `sample_weight`                | number | Inverse sample rate for weighted counts.                                           |

### Runtime telemetry properties

| Property        | Type   | Notes                                                                         |
| --------------- | ------ | ----------------------------------------------------------------------------- |
| `transport`     | string | Runtime transport, e.g. `langgraph`, `ag-ui`, or `custom`.                    |
| `surface`       | string | Adapter surface emitting the event.                                           |
| `requestType`   | string | Request shape, e.g. `submit`, `resubmit`, `regenerate`, `enqueue`, or `join`. |
| `provider`      | string | Model provider when known.                                                    |
| `model`         | string | Model name when known.                                                        |
| `durationMs`    | number | Stream duration for end/error events.                                         |
| `errorClass`    | string | Error class only. Never send error messages.                                  |
| `sample_weight` | number | Inverse sample rate for weighted counts.                                      |

## Shared properties

| Property          | Type   | Notes                                                                                                               |
| ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `source_page`     | string | Stable pathname or surface id (`home`, `compare_langchain_angular`, `pricing`).                                     |
| `source_section`  | string | Stable section/component id where known.                                                                            |
| `surface`         | enum   | `nav` `mobile_nav` `footer` `home` `pricing` `docs` `blog` `library_landing` `solution` `toast` `cockpit` `contact` |
| `destination_url` | string | Clicked URL where applicable.                                                                                       |
| `cta_id`          | string | Stable CTA id (see below).                                                                                          |
| `cta_text`        | string | Visible label where stable.                                                                                         |
| `track`           | enum   | `developer` `enterprise` `pricing` `pilot`                                                                          |
| `paper`           | enum   | `overview` `angular` `render` `chat`                                                                                |
| `library`         | enum   | `agent` `render` `chat` `unknown`                                                                                   |
| `email_domain`    | string | Extracted server-side. Never raw email in client events.                                                            |
| `company`         | string | Server-side only, on conversion events, if approved.                                                                |
| `is_success`      | bool   | Generic success flag for wrapper events.                                                                            |
| `failure_reason`  | string | Short stable code on failure events.                                                                                |
| `referrer_host`   | string | Sanitized host of HTTP referrer.                                                                                    |
| `message_length`  | int    | Lead form / whitepaper message length (never the content).                                                          |
| `message_empty`   | bool   | Whether the free-text body was empty.                                                                               |

## CTA ids (stable, lowercase snake_case)

**Hero**

- `hero_install` — primary, copy-to-clipboard
- `hero_talk_to_engineers` — secondary, → `/contact`

**Nav**

- `nav_get_started` `nav_docs` `nav_pricing` `nav_github` `nav_npm` `nav_cockpit`

**Footer**

- `footer_github` `footer_npm` `footer_cockpit` `footer_pricing` `footer_pilot_to_prod` `footer_contact`

**Comparison pages** (`/compare/<x>`)

- `compare_<x>_install` — primary CTA on each comparison page
- `compare_<x>_talk_to_engineers` — secondary CTA on each comparison page
- `compare_<x>_view_demo` — link to cockpit recipe

**Pricing & Pilot**

- `pricing_enterprise_lead` — pricing page form submit
- `pilot_book_call` — `/pilot-to-prod` form submit

**Contact**

- `contact_send` — `/contact` form submit

## Privacy & redaction rules

- **Never send** raw lead form `message`, raw docs search query, copied code content, or any free-form customer text.
- **Always send** message _length_ and _is_empty_ booleans instead.
- **Email domains only** in client-side events; raw emails never leave the form.
- **Company** is server-side only, on conversion events.
- **Free-form lead body** is never forwarded to PostHog under any property name.
- Treat email, name, company, and any free-form customer text as sensitive.

## Version + change log

This file is human-edited. When events are added/renamed/removed, update the affected event-constant files in the same PR. CI guards `posthog:sync` will warn if a dashboard JSON references an event not listed here.

| Date       | Change                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-13 | Initial draft per Spec 0.                                                                                                      |
| 2026-05-15 | Drop cockpit:install_command_copied, rename cockpit:six_signals_complete → cockpit:activation_complete (Spec 1C).              |
| 2026-05-15 | Cockpit shell events: rename `recipe_start` → `recipe_opened`; add `mode_switched` and `code_copied` (Spec 1C implementation). |
| 2026-05-17 | Add `blog:cta_click` + `blog:copy_code_click` events; add `'blog'` to `AnalyticsSurface` (Spec 5).                             |
| 2026-05-18 | Add `install_context` to `ngaf:postinstall` and filter package telemetry dashboard insights away from `ci` context.            |
