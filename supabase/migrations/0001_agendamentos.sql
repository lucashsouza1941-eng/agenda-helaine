-- Helaine Tranças: tabelas de agendamento.
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez).

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_id text not null,
  date date not null,
  time text not null check (time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  name text not null check (char_length(name) between 2 and 120),
  phone text not null check (char_length(phone) between 8 and 30),
  email text check (email is null or char_length(email) <= 160),
  status text not null default 'Pendente' check (status in ('Pendente', 'Confirmado', 'Cancelado')),
  created_at timestamptz not null default now()
);

-- Um horário só pode ter um agendamento ativo (cancelados liberam o horário).
create unique index if not exists bookings_slot_unico
  on public.bookings (date, time)
  where status <> 'Cancelado';

-- Quem pode entrar no /admin. Cadastre a Helaine aqui depois de criar o usuário dela.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.bookings enable row level security;
alter table public.admins enable row level security;

-- Clientes não acessam as tabelas diretamente: o site grava e lê pelo servidor
-- com a service role key. Só admins logados leem e alteram agendamentos.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy if exists "admin ve a propria linha" on public.admins;
create policy "admin ve a propria linha" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "admin le agendamentos" on public.bookings;
create policy "admin le agendamentos" on public.bookings
  for select to authenticated using (public.is_admin());

drop policy if exists "admin altera agendamentos" on public.bookings;
create policy "admin altera agendamentos" on public.bookings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
