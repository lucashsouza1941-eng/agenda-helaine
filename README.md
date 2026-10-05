# Helaine Tranças — agendamento web

Primeira versão funcional para publicação por URL na Vercel.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Deploy na Vercel

1. Suba esta pasta para um repositório GitHub.
2. Na Vercel, escolha **Add New > Project**.
3. Importe o repositório.
4. Framework detectado: Next.js.
5. Clique em **Deploy**.

## Estado atual

- Home, serviços, galeria, agendamento, meus agendamentos e admin.
- Agendamentos salvos em `localStorage` apenas para prototipação.
- Sem autenticação no `/admin` nesta primeira etapa.
- Preços, PIX, horários reais e imagens oficiais ainda devem ser configurados.

## Próxima etapa recomendada

Conectar Supabase para banco, autenticação do admin, horários reais e persistência entre dispositivos.
