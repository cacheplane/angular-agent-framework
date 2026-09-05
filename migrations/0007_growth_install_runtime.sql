alter table growth_observations add column installation_token_digest text;
alter table growth_observations add constraint growth_installation_token_digest_format
  check (installation_token_digest is null or installation_token_digest ~ '^[0-9a-f]{64}$');
create index growth_observation_installation_token on growth_observations(installation_token_digest,source)
  where installation_token_digest is not null;

create table growth_install_runtime_links (
  runtime_observation_id uuid primary key references growth_observations(id) on delete cascade,
  install_observation_id uuid references growth_observations(id) on delete cascade,
  contact_id uuid references growth_contacts(id) on delete set null,
  outcome text not null check (outcome in ('approved','ineligible','conflicted')),
  evaluated_at timestamptz not null
);
create index growth_install_runtime_contact on growth_install_runtime_links(contact_id)
  where contact_id is not null;
