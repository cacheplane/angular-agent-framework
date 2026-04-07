# Cockpit Testing And Deployment Design

**Date:** 2026-03-20  
**Status:** Proposed  
**Scope:** Testing model, verification layers, and deployment expectations for the cockpit and capability modules.

---

## Goal

Define how the cockpit and full capability matrix are verified and deployed so the examples remain trustworthy as developer-reference assets.

---

## Testing Principle

Testing must align with the cockpit architecture:

- each capability carries its own testing story
- shared harness utilities reduce duplication
- the cockpit validates the integrated system

This mirrors the earlier repo testing strategy instead of creating a separate special case for examples.

---

## Verification Layers

Expected testing layers:

1. Capability smoke
- fast, always-on
- local and CI friendly
- validates registration, boot, and basic execution

2. Capability integration
- verifies runtime-specific behaviors
- may require secrets or external services
- explicitly separated from smoke

3. Cockpit integration
- verifies shell navigation, code/prompt/docs panels, language switching, and capability loading

4. Deploy smoke
- verifies deployed cockpit health and critical routes

---

## Shared Testing Infrastructure

Shared testing helpers should live in dedicated libs and provide:

- common smoke harnesses
- registry validation
- language-switch assertions
- code/prompt/docs consistency checks
- UI navigation helpers

Capability modules should consume these instead of rewriting harness logic.

---

## Capability Testing Contract

Every capability must declare:

- smoke command
- integration command if applicable
- fixtures if applicable
- environment requirements

The cockpit shell should be able to surface this information in the UI and the docs.

This testing contract is part of the shared manifest schema owned by `libs/cockpit-registry`.

---

## Cockpit-Level E2E

The cockpit requires first-class end-to-end coverage for:

- tree navigation
- product and capability routing
- language switching and fallback
- capability surface mount
- code visibility
- docs linkage

These tests validate the shell contract, not capability business logic.

---

## Deployment Model

The cockpit is deployed as a product surface at:

- `cockpit.cacheplane.ai`

Deployment verification should confirm:

- shell is healthy
- critical routes resolve
- representative capability pages load
- language switching does not break on missing parity

---

## CI Model

CI should separate:

- always-on smoke checks
- heavier integration checks
- post-deploy verification

This keeps the developer-reference surface trustworthy without forcing every expensive test into every PR gate.

---

## Non-Goals

This spec does not define:

- exact workflow YAML
- repo layout
- docs authoring structure

---

## Success Criteria

This spec is successful when:

- every capability has an explicit testing contract
- shared harness utilities are part of the design
- cockpit integration is tested separately from individual modules
- deployed cockpit health is verified as part of release quality
