-- Helaine Tranças: preços, duração e horários de atendimento editáveis no /admin.
-- Rode no SQL Editor do Supabase depois do 0004.
-- Enquanto estas tabelas estiverem vazias, o site usa os valores padrão do código.

create table if not exists public.service_settings (
  service_id text primary key check (char_length(service_id) <= 40),
  price text check (price is null or char_length(price) <= 40),
  duration text check (duration is null or char_length(duration) <= 40),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.opening_slots (
  time text primary key check (time ~ '^[0-2][0-9]:[0-5][0-9]$')
);

alter table public.service_settings enable row level security;
alter table public.opening_slots enable row level security;

-- Clientes leem pelo servidor (service role). Só admins alteram.
drop policy if exists "admin le servicos" on public.service_settings;
create policy "admin le servicos" on public.service_settings
  for select to authenticated using (public.is_admin());
drop policy if exists "admin cria servicos" on public.service_settings;
create policy "admin cria servicos" on public.service_settings
  for insert to authenticated with check (public.is_admin());
drop policy if exists "admin altera servicos" on public.service_settings;
create policy "admin altera servicos" on public.service_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin le horarios" on public.opening_slots;
create policy "admin le horarios" on public.opening_slots
  for select to authenticated using (public.is_admin());
drop policy if exists "admin cria horarios" on public.opening_slots;
create policy "admin cria horarios" on public.opening_slots
  for insert to authenticated with check (public.is_admin());
drop policy if exists "admin remove horarios" on public.opening_slots;
create policy "admin remove horarios" on public.opening_slots
  for delete to authenticated using (public.is_admin());
