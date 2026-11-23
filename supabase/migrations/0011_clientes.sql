-- Helaine Tranças: cadastro de clientes (opcional).
-- Rode no SQL Editor do Supabase depois do 0010.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  -- Telefone só com dígitos, com DDD e sem o 55 (ex.: 11958581395). É o "login" da cliente.
  phone text not null unique check (phone ~ '^[0-9]{10,11}$'),
  email text not null check (char_length(email) between 5 and 160),
  -- Senha de 4 números, guardada embaralhada (scrypt). Vazio = cliente sem senha.
  pin_hash text,
  -- Tentativas erradas de entrar e bloqueio temporário.
  failed_logins integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

-- O site lê e grava pelo servidor (service role). Admins leem pelo painel.
drop policy if exists "admin le clientes" on public.clients;
create policy "admin le clientes" on public.clients
  for select to authenticated using (public.is_admin());

-- Agendamento feito por cliente cadastrada. Apagar a cliente não apaga os agendamentos.
alter table public.bookings add column if not exists client_id uuid references public.clients (id) on delete set null;
create index if not exists bookings_client on public.bookings (client_id) where client_id is not null;
