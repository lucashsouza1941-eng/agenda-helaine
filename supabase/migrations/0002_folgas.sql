-- Helaine Tranças: dias de folga (dias sem atendimento).
-- Rode no SQL Editor do Supabase depois do 0001.

create table if not exists public.blocked_dates (
  date date primary key,
  reason text check (reason is null or char_length(reason) <= 120),
  created_at timestamptz not null default now()
);

alter table public.blocked_dates enable row level security;

-- Clientes consultam as folgas pelo servidor (service role). Só admins gerenciam.
drop policy if exists "admin le folgas" on public.blocked_dates;
create policy "admin le folgas" on public.blocked_dates
  for select to authenticated using (public.is_admin());

drop policy if exists "admin cria folgas" on public.blocked_dates;
create policy "admin cria folgas" on public.blocked_dates
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admin remove folgas" on public.blocked_dates;
create policy "admin remove folgas" on public.blocked_dates
  for delete to authenticated using (public.is_admin());

-- Trava no banco: nenhum agendamento novo em dia de folga, mesmo se a cliente
-- estava com a página aberta antes do bloqueio.
create or replace function public.bloqueia_agendamento_em_folga()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.blocked_dates where date = new.date) then
    raise exception 'dia_de_folga' using errcode = 'P0001', hint = 'blocked_date';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_sem_folga on public.bookings;
create trigger bookings_sem_folga
  before insert on public.bookings
  for each row execute function public.bloqueia_agendamento_em_folga();
