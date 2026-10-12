-- Helaine Tranças: horários bloqueados (um horário específico sem atendimento).
-- Rode no SQL Editor do Supabase depois do 0003.

create table if not exists public.blocked_slots (
  date date not null,
  time text not null check (time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  reason text check (reason is null or char_length(reason) <= 120),
  created_at timestamptz not null default now(),
  primary key (date, time)
);

alter table public.blocked_slots enable row level security;

-- Clientes consultam pelo servidor (service role). Só admins gerenciam.
drop policy if exists "admin le horarios bloqueados" on public.blocked_slots;
create policy "admin le horarios bloqueados" on public.blocked_slots
  for select to authenticated using (public.is_admin());

drop policy if exists "admin cria horarios bloqueados" on public.blocked_slots;
create policy "admin cria horarios bloqueados" on public.blocked_slots
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admin remove horarios bloqueados" on public.blocked_slots;
create policy "admin remove horarios bloqueados" on public.blocked_slots
  for delete to authenticated using (public.is_admin());

-- Trava no banco: nenhum agendamento novo num horário bloqueado.
create or replace function public.bloqueia_agendamento_em_horario_bloqueado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.blocked_slots where date = new.date and time = new.time) then
    raise exception 'horario_bloqueado' using errcode = 'P0001', hint = 'blocked_slot';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_sem_horario_bloqueado on public.bookings;
create trigger bookings_sem_horario_bloqueado
  before insert on public.bookings
  for each row execute function public.bloqueia_agendamento_em_horario_bloqueado();
