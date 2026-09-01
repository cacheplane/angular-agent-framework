---
name: runway-analysis
description: Decide whether a runway is long enough for a given aircraft at a given field elevation. Use when the user asks about runway suitability, takeoff or landing distance, or operating out of a high-elevation field.
license: MIT
---

# Runway Analysis

## When to use

The user is asking whether an aircraft can safely operate from a specific
runway, or is comparing two airports for a trip.

## Procedure

1. Get the field elevation and the longest runway length with
   `lookup_field_elevation` and `lookup_runway_length`.
2. Read `/skills/runway-analysis/reference/margins.md` for the required margin
   table. Do not work from memory — the table is the authority.
3. Compare the runway length against the required distance for the aircraft
   class at that elevation.
4. State the verdict in one sentence, then give the two numbers you compared.

## Reporting

Always name the margin you applied. A verdict without the margin is not
reviewable.
