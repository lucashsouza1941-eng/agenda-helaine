# Helaine Tranças — agendamento web

Site de agendamento em Next.js com banco e login de admin no Supabase.

- **Clientes:** escolhem serviço, data e horário livre em `/agendar`. Não precisam de conta. Em `/meus-agendamentos` veem os agendamentos feitos naquele aparelho.
- **Helaine:** entra em `/admin` com e-mail e senha, vê os próximos agendamentos (com link para o WhatsApp da cliente) e confirma ou cancela cada um.
- **Dias de folga:** no `/admin`, a Helaine bloqueia um dia ou um período (férias). Esses dias ficam indisponíveis para as clientes; agendamentos que já existiam nesses dias continuam na agenda e o painel avisa.
- Novos agendamentos entram como **Pendente**. Um horário só aceita um agendamento ativo; cancelar libera o horário.

## Configurar o Supabase (uma vez)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, cole e rode o conteúdo de `supabase/migrations/0001_agendamentos.sql` e depois o de `supabase/migrations/0002_folgas.sql` (um de cada vez, nessa ordem).
3. Em **Authentication > Sign In / Providers**, desative **Allow new users to sign up** (só a Helaine terá conta).
4. Em **Authentication > Users > Add user**, crie o usuário da Helaine com e-mail e senha (marque *Auto Confirm User*).
5. No **SQL Editor**, dê permissão de admin a ela (troque o e-mail):

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'email-da-helaine@exemplo.com';
   ```

6. Em **Project Settings > API**, copie a URL e as chaves para as variáveis de ambiente (veja `.env.example`):

   | Variável | Onde achar |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave `anon` / *publishable* |
   | `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` / *secret* — **nunca compartilhe** |

## Rodar localmente

```bash
cp .env.example .env.local   # e preencha com as chaves
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Deploy na Vercel

1. Importe este repositório na Vercel (**Add New > Project**).
2. Em **Environment Variables**, adicione as três variáveis acima.
3. Clique em **Deploy**. Se adicionar ou trocar variáveis depois, faça um novo deploy.

## Segurança

- As clientes nunca acessam o banco direto: o site grava e consulta pelo servidor, com a `service_role` key.
- A outra cliente vê só que um horário está ocupado, nunca nome ou telefone.
- Regras de RLS no banco: só usuários listados em `public.admins` leem e alteram agendamentos.

## Próximos passos

- Preços, PIX, horários reais e fotos oficiais.
- Bloquear horários específicos (não só o dia inteiro).
- Proteção contra spam no formulário (ex.: Cloudflare Turnstile).
