create table if not exists public.security_clone_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null default 'clone_beacon',
  risk_score integer not null default 0,
  page text,
  reported_host text not null,
  official_host text,
  href text,
  referrer text,
  origin text,
  source_url text,
  screen text,
  timezone text,
  language text,
  user_agent text,
  client_ip text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists security_clone_events_created_at_idx
  on public.security_clone_events (created_at desc);

create index if not exists security_clone_events_reported_host_idx
  on public.security_clone_events (reported_host);

create index if not exists security_clone_events_risk_score_idx
  on public.security_clone_events (risk_score desc);
