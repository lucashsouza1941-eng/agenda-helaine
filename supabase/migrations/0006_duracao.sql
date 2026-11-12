-- Helaine Tranças: cada agendamento ocupa o tempo do serviço, não só o horário de início.
-- Rode no SQL Editor do Supabase depois do 0005.

-- Tempo reservado na agenda para cada serviço (em minutos). Editável no /admin.
alter table public.service_settings
  add column if not exists duration_minutes integer
  check (duration_minutes is null or duration_minutes between 30 and 720);

-- Tempo que cada agendamento ocupa. Fica gravado no agendamento: mudar o tempo
-- do serviço depois não altera os agendamentos que já existem.
alter table public.bookings
  add column if not exists duration_minutes integer
  check (duration_minutes is null or duration_minutes between 30 and 720);

-- Agendamentos antigos: usa o tempo padrão de cada serviço.
update public.bookings set duration_minutes = case service_id
    when 'box-braids' then 360
    when 'nago' then 240
    when 'twist' then 300
    when 'chanel' then 300
    when 'manutencao' then 180
    else 60
  end
  where duration_minutes is null;

alter table public.bookings alter column duration_minutes set default 60;
alter table public.bookings alter column duration_minutes set not null;

-- 'HH:MM' em minutos desde a meia-noite.
create or replace function public.minutos(t text)
returns integer
language sql
immutable
as $$
  select split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int;
$$;

-- Trava no banco: um agendamento não pode começar enquanto outro ainda está em
-- atendimento, nem passar por cima de um horário bloqueado.
create or replace function public.bloqueia_agendamento_sobreposto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inicio integer := public.minutos(new.time);
  fim integer := public.minutos(new.time) + new.duration_minutes;
begin
  if new.status = 'Cancelado' then
    return new;
  end if;
  -- Só reativar ou mover um agendamento precisa conferir de novo.
  if tg_op = 'UPDATE' and old.status <> 'Cancelado' and old.date = new.date
     and old.time = new.time and old.duration_minutes = new.duration_minutes then
    return new;
  end if;

  -- Um agendamento por vez em cada dia: evita que dois pedidos simultâneos passem juntos.
  perform pg_advisory_xact_lock(hashtext('bookings ' || new.date::text));

  if exists (
    select 1 from public.bookings b
    where b.date = new.date and b.status <> 'Cancelado' and b.id <> new.id
      and public.minutos(b.time) < fim
      and inicio < public.minutos(b.time) + b.duration_minutes
  ) then
    raise exception 'horario_ocupado' using errcode = 'P0001', hint = 'overlap';
  end if;

  if exists (
    select 1 from public.blocked_slots s
    where s.date = new.date and public.minutos(s.time) >= inicio and public.minutos(s.time) < fim
  ) then
    raise exception 'horario_bloqueado' using errcode = 'P0001', hint = 'blocked_slot';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_sem_sobreposicao on public.bookings;
create trigger bookings_sem_sobreposicao
  before insert or update of status, date, time, duration_minutes on public.bookings
  for each row execute function public.bloqueia_agendamento_sobreposto();
