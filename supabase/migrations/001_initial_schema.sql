-- Font Builder — initial schema (collaboration layer; not wired in MVP single-user core)

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  invite_token text unique not null,
  owner_session_id uuid not null,
  font_metadata jsonb not null,
  metrics jsonb not null,
  preset text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists glyphs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  unicode text not null,
  char text not null,
  status text not null default 'empty',
  original_svg_path text,
  normalized_path text,
  transform jsonb not null,
  metrics jsonb not null,
  errors jsonb default '[]'::jsonb,
  warnings jsonb default '[]'::jsonb,
  locked_by uuid,
  locked_at timestamptz,
  updated_by uuid,
  updated_at timestamptz default now(),
  unique (project_id, unicode)
);

create table if not exists kerning_pairs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  left_unicode text not null,
  right_unicode text not null,
  value integer not null,
  updated_at timestamptz default now(),
  unique (project_id, left_unicode, right_unicode)
);

create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text,
  state_snapshot jsonb not null,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists sessions (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  color text not null,
  is_owner boolean default false,
  joined_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  session_id uuid,
  session_name text not null,
  action text not null,
  target text,
  created_at timestamptz default now()
);

create index if not exists idx_glyphs_project on glyphs(project_id);
create index if not exists idx_kerning_project on kerning_pairs(project_id);
create index if not exists idx_audit_project_created on audit_log(project_id, created_at desc);
create index if not exists idx_sessions_project on sessions(project_id);
create index if not exists idx_projects_invite on projects(invite_token);

-- RLS (token-scoped; see spec §4.4). Enable and add policies before going multi-user.
-- alter table projects enable row level security;
-- ... policies omitted in MVP single-user core.
