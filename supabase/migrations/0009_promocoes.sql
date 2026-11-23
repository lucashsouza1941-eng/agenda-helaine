-- Helaine Tranças: promoções.
-- Rode no SQL Editor do Supabase depois do 0008.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  -- Serviço em promoção. Vazio (null) = vale para todos os serviços.
  service_id text references public.services (id) on delete cascade,
  -- Período em que o ATENDIMENTO precisa acontecer para a promoção valer.
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  -- Texto livre que a cliente lê (ex.: "R$ 300,00" ou "10% de desconto").
  price text not null check (char_length(price) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists promotions_periodo on public.promotions (ends_on);

alter table public.promotions enable row level security;

-- Clientes leem pelo servidor (service role). Só admins gerenciam.
drop policy if exists "admin le promocoes" on public.promotions;
create policy "admin le promocoes" on public.promotions
  for select to authenticated using (public.is_admin());
drop policy if exists "admin cria promocoes" on public.promotions;
create policy "admin cria promocoes" on public.promotions
  for insert to authenticated with check (public.is_admin());
drop policy if exists "admin altera promocoes" on public.promotions;
create policy "admin altera promocoes" on public.promotions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin apaga promocoes" on public.promotions;
create policy "admin apaga promocoes" on public.promotions
  for delete to authenticated using (public.is_admin());

-- O agendamento guarda a promoção que valia no dia (nome e preço), para a Helaine
-- saber o que foi combinado mesmo se a promoção for editada ou apagada depois.
alter table public.bookings add column if not exists promo_title text
  check (promo_title is null or char_length(promo_title) <= 160);
