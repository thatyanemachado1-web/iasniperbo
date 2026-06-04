create table if not exists public.local_ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  mesa text not null default 'Mesa principal',
  event text not null,
  question text,
  payload jsonb not null default '{}'::jsonb,
  response text not null,
  provider text not null default 'ollama',
  model text not null default 'qwen2.5:7b',
  duration_ms integer not null default 0,
  estimated_cost numeric not null default 0,
  status text not null default 'ok',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists local_ai_usage_logs_created_idx
  on public.local_ai_usage_logs (created_at desc);

create index if not exists local_ai_usage_logs_user_idx
  on public.local_ai_usage_logs (user_key, created_at desc);

create table if not exists public.local_ai_settings (
  id text primary key default 'main',
  enabled boolean not null default true,
  narration_enabled boolean not null default true,
  ollama_base_url text not null default 'http://localhost:11434',
  ollama_model text not null default 'qwen2.5:7b',
  voice_provider text not null default 'edge-tts',
  voice_name text not null default 'pt-BR-AntonioNeural',
  voice_volume numeric not null default 0.9,
  voice_rate numeric not null default 1,
  voice_pitch numeric not null default 0.95,
  calls_per_minute integer not null default 12,
  cooldown_ms integer not null default 8000,
  updated_at timestamptz not null default now()
);
