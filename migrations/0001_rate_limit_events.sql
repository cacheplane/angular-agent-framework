-- migrations/0001_rate_limit_events.sql
-- Rate-limit storage for the canonical demo proxy.
-- See docs/superpowers/specs/2026-05-13-canonical-demo-rate-limit-design.md

CREATE TABLE IF NOT EXISTS rate_limit_events (
  ip   TEXT        NOT NULL,
  ts   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_ip_ts
  ON rate_limit_events (ip, ts DESC);
