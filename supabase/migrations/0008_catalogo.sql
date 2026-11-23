-- Helaine Tranças: catálogo de serviços no banco e observações no agendamento.
-- Rode no SQL Editor do Supabase depois do 0007.

-- Serviços: antes eram 5 fixos no código; agora o /admin cria e edita.
create table if not exists public.services (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 40),
  name text not null check (char_length(name) between 2 and 60),
  -- 'tranca' aparece em "Tranças", 'corte' em "Cortes de cabelo" e 'outro' em "Outros serviços".
  category text not null default 'tranca' check (category in ('tranca', 'corte', 'outro')),
  description text not null default '' check (char_length(description) <= 300),
  -- Texto que a cliente lê (ex.: "6 horas", "3 a 4 horas").
  duration_label text not null default '' check (char_length(duration_label) <= 40),
  -- Tempo reservado na agenda.
  duration_minutes integer not null default 60 check (duration_minutes between 30 and 720),
  -- Texto livre (ex.: "a partir de R$ 350,00"). Em branco aparece "A definir".
  price text not null default '' check (char_length(price) <= 40),
  -- Caminho de uma foto em /public (ex.: /images/servicos/nago.jpg) ou vazio.
  photo text not null default '' check (char_length(photo) <= 200),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services enable row level security;

-- Clientes leem pelo servidor (service role). Só admins criam e alteram.
-- Não há policy de delete: serviço com agendamento não se apaga, só se esconde do site.
drop policy if exists "admin le catalogo" on public.services;
create policy "admin le catalogo" on public.services
  for select to authenticated using (public.is_admin());
drop policy if exists "admin cria no catalogo" on public.services;
create policy "admin cria no catalogo" on public.services
  for insert to authenticated with check (public.is_admin());
drop policy if exists "admin altera catalogo" on public.services;
create policy "admin altera catalogo" on public.services
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Catálogo inicial. Os 5 serviços que já existiam mantêm o mesmo id (os agendamentos
-- antigos apontam para eles) e aproveitam o que já foi editado no /admin
-- (tabela service_settings). Rodar de novo não sobrescreve nada: "on conflict do nothing".
with padrao (id, name, category, description, duration_label, duration_minutes, price, photo, sort) as (values
  ('box-braids', 'Box Braids', 'tranca', 'Tranças soltas em caixinhas, versáteis e clássicas. Duram de 2 a 3 meses com boa manutenção.', '6 horas', 360, 'a partir de R$ 350,00', '/images/servicos/box-braids.jpg', 10),
  ('knotless-braids', 'Knotless Braids', 'tranca', 'Box braids sem nó na raiz: mais leves e confortáveis no couro cabeludo.', '7 horas', 420, 'a partir de R$ 420,00', '', 20),
  ('fulani-braids', 'Fulani Braids', 'tranca', 'Tranças rentes na frente e soltas atrás, com acessórios e desenho marcante.', '5 horas', 300, 'a partir de R$ 380,00', '', 30),
  ('twist', 'Twist Senegalês', 'tranca', 'Mechas torcidas como corda, com visual leve e contemporâneo.', '5 horas', 300, 'a partir de R$ 320,00', '/images/servicos/twist.jpg', 40),
  ('chanel', 'Tranças Chanel', 'tranca', 'Tranças curtas, na altura do queixo: elegância e praticidade.', '5 horas', 300, '', '/images/servicos/chanel.jpg', 50),
  ('nago', 'Nagô (Cornrow)', 'tranca', 'Tranças rentes ao couro cabeludo, em fileiras, com acabamento personalizado.', '3 horas', 180, 'a partir de R$ 180,00', '/images/servicos/nago.jpg', 60),
  ('boxeadora', 'Boxeadora', 'tranca', 'Duas tranças nagô, uma de cada lado. Prática e rápida.', '1h30', 90, 'a partir de R$ 90,00', '', 70),
  ('nago-coracao', 'Nagô desenho coração', 'tranca', 'Nagô com desenho de coração.', '3h30', 210, 'a partir de R$ 220,00', '', 80),
  ('nago-coroa', 'Nagô desenho coroa', 'tranca', 'Nagô com desenho de coroa.', '3h30', 210, 'a partir de R$ 220,00', '', 90),
  ('nago-curvas-laterais', 'Nagô desenho curvas laterais', 'tranca', 'Nagô com curvas nas laterais.', '3 horas', 180, 'a partir de R$ 190,00', '', 100),
  ('nago-espiral', 'Nagô desenho espiral', 'tranca', 'Nagô com desenho em espiral.', '3h30', 210, 'a partir de R$ 210,00', '', 110),
  ('nago-estrela', 'Nagô desenho estrela', 'tranca', 'Nagô com desenho de estrela.', '4 horas', 240, 'a partir de R$ 250,00', '', 120),
  ('nago-folhas', 'Nagô desenho folhas', 'tranca', 'Nagô com desenho de folhas.', '4 horas', 240, 'a partir de R$ 230,00', '', 130),
  ('nago-geometrico', 'Nagô desenho geométrico', 'tranca', 'Nagô com linhas e formas geométricas.', '3 horas', 180, 'a partir de R$ 190,00', '', 140),
  ('nago-teia', 'Nagô desenho teia', 'tranca', 'Nagô com desenho de teia.', '4h30', 270, 'a partir de R$ 260,00', '', 150),
  ('nago-tribal', 'Nagô desenho tribal', 'tranca', 'Nagô com desenho tribal.', '4 horas', 240, 'a partir de R$ 240,00', '', 160),
  ('nago-zig-zag', 'Nagô desenho zig-zag', 'tranca', 'Nagô com divisões em zig-zag.', '3 horas', 180, 'a partir de R$ 190,00', '', 170),
  ('manutencao', 'Manutenção', 'outro', 'Retoque para prolongar a beleza e a durabilidade das suas tranças.', '2 horas', 120, 'a partir de R$ 120,00', '/images/servicos/manutencao.jpg', 200),
  ('hidratacao', 'Hidratação', 'outro', 'Tratamento para devolver água e maciez aos fios.', '1h30', 90, 'a partir de R$ 80,00', '', 210),
  ('corte-reto', 'Corte reto (alinhamento)', 'corte', 'Alinhamento das pontas, mantendo o comprimento.', '1 hora', 60, 'a partir de R$ 60,00', '', 300),
  ('corte-repicado', 'Corte repicado', 'corte', 'Pontas em alturas diferentes, para dar movimento.', '1 hora', 60, 'a partir de R$ 75,00', '', 310),
  ('corte-camadas', 'Corte em camadas', 'corte', 'Camadas que dão volume e leveza ao cabelo.', '1h30', 90, 'a partir de R$ 90,00', '', 320),
  ('corte-redondo-cachos', 'Corte redondo para cachos', 'corte', 'Formato arredondado que valoriza os cachos.', '1h30', 90, 'a partir de R$ 95,00', '', 330),
  ('corte-chanel', 'Chanel', 'corte', 'Corte reto na altura do queixo.', '1h30', 90, 'a partir de R$ 85,00', '', 340),
  ('corte-long-bob', 'Long bob', 'corte', 'Chanel mais longo, na altura dos ombros.', '1h30', 90, 'a partir de R$ 90,00', '', 350),
  ('corte-franja', 'Franja (com corte)', 'corte', 'Corte com franja no estilo que você escolher.', '1h30', 90, 'a partir de R$ 85,00', '', 360),
  ('corte-pixie', 'Pixie cut', 'corte', 'Corte curtinho, prático e marcante.', '1h30', 90, 'a partir de R$ 90,00', '', 370),
  ('corte-undercut', 'Undercut feminino', 'corte', 'Lateral ou nuca raspada, com o restante mais longo.', '1h30', 90, 'a partir de R$ 80,00', '', 380),
  ('corte-big-chop', 'Big chop (transição)', 'corte', 'Remoção da parte alisada, para valorizar a textura natural na transição capilar.', '2 horas', 120, 'a partir de R$ 110,00', '', 390)
)
insert into public.services (id, name, category, description, duration_label, duration_minutes, price, photo, active, sort)
select p.id, p.name, p.category, p.description,
       coalesce(nullif(ss.duration, ''), p.duration_label),
       coalesce(ss.duration_minutes, p.duration_minutes),
       coalesce(nullif(ss.price, ''), p.price),
       p.photo, coalesce(ss.active, true), p.sort
from padrao p
left join public.service_settings ss on ss.service_id = p.id
on conflict (id) do nothing;

-- O agendamento guarda o nome do serviço como estava no dia (se o serviço for
-- renomeado ou escondido depois, a agenda continua legível) e as observações da cliente.
alter table public.bookings add column if not exists service_name text
  check (service_name is null or char_length(service_name) <= 60);
alter table public.bookings add column if not exists notes text
  check (notes is null or char_length(notes) <= 500);

update public.bookings b set service_name = s.name
  from public.services s
  where b.service_name is null and s.id = b.service_id;
