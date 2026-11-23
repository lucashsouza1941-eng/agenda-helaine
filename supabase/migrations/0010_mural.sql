-- Helaine Tranças: mural de fotos (clientes enviam, admin aprova).
-- Rode no SQL Editor do Supabase depois do 0009.

create table if not exists public.mural_photos (
  id uuid primary key default gen_random_uuid(),
  -- Nome do arquivo no Storage (ex.: 3f2a....jpg).
  path text not null unique check (path ~ '^[0-9a-f-]{36}\.jpg$'),
  caption text not null default '' check (char_length(caption) <= 120),
  -- Quem enviou (primeiro nome, opcional).
  author text not null default '' check (char_length(author) <= 40),
  -- 'pendente': esperando a Helaine. 'aprovada': aparece no site. Foto recusada é apagada.
  status text not null default 'pendente' check (status in ('pendente', 'aprovada')),
  -- 'cliente': enviada pelo site. 'admin': publicada pelo painel.
  source text not null default 'cliente' check (source in ('cliente', 'admin')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create index if not exists mural_photos_status on public.mural_photos (status, created_at desc);

alter table public.mural_photos enable row level security;

-- O site grava e lê pelo servidor (service role). Admins leem pelo painel.
drop policy if exists "admin le mural" on public.mural_photos;
create policy "admin le mural" on public.mural_photos
  for select to authenticated using (public.is_admin());

-- Onde os arquivos ficam. Duas pastas (buckets) no Storage:
--   mural-pendente: privada. Foto enviada pela cliente espera aqui; ninguém de fora abre.
--   mural: pública. A foto só vem para cá quando a Helaine aprova.
-- Limite de 2 MB por arquivo, só JPEG (o site reduz a foto antes de enviar).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('mural-pendente', 'mural-pendente', false, 2097152, array['image/jpeg']),
  ('mural', 'mural', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;
