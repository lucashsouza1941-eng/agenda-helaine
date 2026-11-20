-- Helaine Tranças: painel do tablet (/admin/tablet).
-- Rode no SQL Editor do Supabase depois do 0006.

-- Novo status: atendimento que já aconteceu.
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('Pendente', 'Confirmado', 'Finalizado', 'Cancelado'));

-- Quando o lembrete foi enviado à cliente (lembreteEnviadoEm).
alter table public.bookings add column if not exists reminder_sent_at timestamptz;
