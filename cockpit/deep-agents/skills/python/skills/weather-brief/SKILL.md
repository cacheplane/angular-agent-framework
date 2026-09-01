---
name: weather-brief
description: Turn a raw field observation into a short operational weather brief. Use when the user asks about conditions, ceilings, visibility, or whether the weather is a problem for a departure or arrival.
license: MIT
---

# Weather Brief

## When to use

The user wants to know what the current conditions mean, not just what they are.

## Procedure

1. Get the observation with `lookup_weather`.
2. Classify the ceiling: below 1,000 ft is low, 1,000 to 3,000 ft is marginal,
   above 3,000 ft is unrestricted.
3. Call out any gust spread greater than 8 knots and any advisory in the
   observation text.

## Reporting

Two sentences: the conditions, then the operational consequence. Never repeat
the raw observation verbatim.
