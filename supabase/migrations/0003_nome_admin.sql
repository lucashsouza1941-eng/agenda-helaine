-- Helaine Tranças: nome de cada admin, usado na saudação do painel.
-- Rode no SQL Editor do Supabase depois do 0002.

alter table public.admins
  add column if not exists name text check (name is null or char_length(name) <= 60);
