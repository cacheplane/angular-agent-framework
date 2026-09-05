CREATE VIEW growth_observation_source_health_v1 AS
SELECT source, kind, collector_version,
  CASE WHEN source='install' THEN properties->>'environment' END AS environment,
  count(*) AS observation_count,
  count(DISTINCT subject_id) AS subject_count,
  count(DISTINCT (subject_id,session_id)) FILTER (WHERE session_id IS NOT NULL) AS session_count,
  max(received_at) AS last_received_at
FROM growth_observations
GROUP BY source, kind, collector_version, CASE WHEN source='install' THEN properties->>'environment' END;

CREATE VIEW growth_observation_subject_overview_v1 AS
SELECT s.id AS subject_id,s.namespace,s.first_received_at,s.last_received_at,
  count(o.id) AS observation_count,
  count(o.id) FILTER (WHERE f.observation_id IS NULL) AS unprojected_count,
  count(DISTINCT o.session_id) AS session_count,
  count(DISTINCT f.active_day) AS active_days,
  count(DISTINCT (f.milestone_kind,o.properties->>'integration')) FILTER (WHERE f.milestone_kind IS NOT NULL) AS attained_milestone_count
FROM growth_observation_subjects s
LEFT JOIN growth_observations o ON o.subject_id=s.id
LEFT JOIN growth_observation_facts f ON f.observation_id=o.id
GROUP BY s.id;

CREATE VIEW growth_observation_work_health_v1 AS
SELECT status,projection_version,count(*) AS work_count,
  count(*) FILTER (WHERE status='pending' AND available_at<=now()) AS due_count,
  count(*) FILTER (WHERE status='leased' AND lease_until<=now()) AS expired_lease_count,
  min(o.received_at) FILTER (WHERE status<>'completed') AS oldest_unprocessed_receipt,
  max(attempts) AS maximum_attempts
FROM growth_observation_work w JOIN growth_observations o ON o.id=w.observation_id
GROUP BY status,projection_version;
