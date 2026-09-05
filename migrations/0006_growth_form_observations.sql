ALTER TABLE growth_observation_subjects DROP CONSTRAINT growth_observation_subjects_namespace_check;
ALTER TABLE growth_observation_subjects ADD CONSTRAINT growth_observation_subjects_namespace_check
  CHECK (namespace IN ('website_session','installation','development_browser','form_submission'));
ALTER TABLE growth_observations DROP CONSTRAINT growth_observations_source_check;
ALTER TABLE growth_observations ADD CONSTRAINT growth_observations_source_check CHECK (source IN ('website','install','runtime','form'));
ALTER TABLE growth_observations DROP CONSTRAINT growth_observations_trust_check;
ALTER TABLE growth_observations ADD CONSTRAINT growth_observations_trust_check CHECK (
  (source='form' AND trust='server_verified' AND kind='form.accepted') OR
  (source IN ('website','install','runtime') AND trust='client_reported' AND kind<>'form.accepted')
);
ALTER TABLE growth_observation_facts DROP CONSTRAINT growth_observation_facts_source_check;
ALTER TABLE growth_observation_facts ADD CONSTRAINT growth_observation_facts_source_check CHECK (source IN ('website','install','runtime','form'));

CREATE TABLE growth_observation_form_links (
  observation_id uuid PRIMARY KEY REFERENCES growth_observations(id) ON DELETE CASCADE,
  activity_id bigint NOT NULL UNIQUE REFERENCES growth_activity(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES growth_contacts(id) ON DELETE CASCADE
);
CREATE INDEX growth_observation_form_links_contact ON growth_observation_form_links(contact_id);
CREATE INDEX growth_activity_form_observation_candidates ON growth_activity(id)
  WHERE kind='contact.form_submission' AND event_key LIKE 'form:%:accepted';
