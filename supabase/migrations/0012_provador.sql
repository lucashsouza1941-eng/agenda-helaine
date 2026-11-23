-- Helaine Tranças: provador de tranças com IA (a cliente vê uma prévia da trança na própria foto).
-- Rode no SQL Editor do Supabase depois do 0011.

-- Cada linha é uma foto gerada. Serve para contar o limite por cliente.
-- A foto em si NÃO é guardada: ela vai para a IA, volta para o navegador e some do servidor.
create table if not exists public.tryon_uses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  service_id text not null check (char_length(service_id) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists tryon_uses_client on public.tryon_uses (client_id);

alter table public.tryon_uses enable row level security;

-- O site lê e grava pelo servidor (service role). Admins leem pelo painel.
drop policy if exists "admin le provador" on public.tryon_uses;
create policy "admin le provador" on public.tryon_uses
  for select to authenticated using (public.is_admin());

-- Fotos a mais que a Helaine liberou para a cliente, além das gratuitas.
alter table public.clients add column if not exists tryon_extra integer not null default 0
  check (tryon_extra between 0 and 100);
