# Painel do tablet (`/admin/tablet`)

Agenda do dia para um iPad antigo (iPad 2, Safari do iOS 9.3.5) deixado no salão. Mostra os atendimentos do dia e permite confirmar, finalizar, cancelar, desfazer e registrar lembrete.

A página é HTML pronto vindo do servidor: não carrega React nem nenhum arquivo JavaScript do site. O pouco script que existe é ES5 (relógio, pergunta antes de cancelar e recarga a cada 60 segundos).

## Por que precisa de um computador na rede

O iOS 9 não aceita os certificados HTTPS atuais, então o iPad **não abre** o endereço `https://...vercel.app`. O painel precisa ser servido por HTTP por um computador na mesma rede Wi-Fi do iPad. Esse computador conversa com o Supabase normalmente; o iPad só conversa com o computador.

## Como rodar

1. **Banco:** no SQL Editor do Supabase, rode `supabase/migrations/0007_tablet.sql` (uma vez).
2. **No computador** (com [Node.js](https://nodejs.org) 20 ou mais novo), dentro da pasta do projeto, crie o arquivo `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
   TABLET_PIN=482913
   ```

3. Instale, compile e ligue o servidor:

   ```bash
   npm install
   npm run build
   npm start
   ```

   O servidor escuta em `0.0.0.0:3000`, ou seja, aceita conexões de outros aparelhos da rede (`npm run dev` também). Para outra porta: `npm start -- -p 8080`. No Windows, quando o firewall perguntar, permita em **redes privadas**.

4. Descubra o IP do computador na rede: `ipconfig` no Windows (linha "Endereço IPv4"), `ipconfig getifaddr en0` no Mac ou `hostname -I` no Linux.

## A variável `TABLET_PIN`

- É a senha do painel. Use **6 dígitos ou mais** (o mínimo aceito é 4). Sem ela, `/admin/tablet` fica desligado.
- Depois de digitar o PIN, o iPad fica logado por 1 ano. Trocar o PIN desloga todos os aparelhos.
- Cinco PINs errados bloqueiam novas tentativas por 10 minutos.
- Essa sessão só vale em `/admin/tablet`: não dá acesso ao `/admin` nem a nenhuma outra parte do site.
- Não precisa cadastrar `TABLET_PIN` na Vercel. Sem ela, o painel do tablet não existe no site público, o que é o mais seguro (o iPad não conseguiria abrir por lá de qualquer forma).

## Como abrir no iPad

1. Conecte o iPad no mesmo Wi-Fi do computador.
2. No Safari, abra `http://IP-DO-COMPUTADOR:3000/admin/tablet` (por exemplo `http://192.168.0.10:3000/admin/tablet`). Tem que ser `http://`, não `https://`.
3. Digite o PIN.
4. Toque em **Compartilhar → Adicionar à Tela de Início**. Abrindo pelo ícone, o painel fica em tela cheia.

O computador precisa ficar ligado, com o `npm start` rodando. Se ele desligar, o iPad mantém a última lista na tela e avisa "sem conexão com o computador". Vale fixar o IP do computador no roteador para o endereço não mudar.

## O que cada botão faz

| Botão | Efeito | Vale para |
| --- | --- | --- |
| Confirmar | vira **Confirmado** | A confirmar |
| Finalizar | vira **Finalizado** | A confirmar, Confirmado |
| Cancelar | vira **Cancelado** e libera o horário (pergunta antes) | A confirmar, Confirmado |
| Desfazer | volta para **A confirmar** (pergunta antes) | Finalizado, Cancelado |
| Lembrete | grava o horário do lembrete | A confirmar, Confirmado |

"A confirmar" é o status `Pendente` do banco. "Desfazer" em um cancelado falha se outra cliente já pegou o horário.

## Limitações

- **O lembrete ainda não envia mensagem.** O projeto não tem um serviço de envio (só links `wa.me`, que dependem do WhatsApp no aparelho). O botão grava a hora em `reminder_sent_at`, escreve no log do servidor a mensagem que seria enviada e a tela mostra "lembrete registrado HH:MM". Para enviar de verdade, ligue um provedor em `lib/tablet/reminder.ts` (há um `TODO` lá); a tela passa a mostrar "lembrete enviado".
- **Não há campo de observação** nos agendamentos. Na linha de observação o painel mostra os avisos da agenda ("Marcado em dia de folga", "Passa por um horário bloqueado").
- **O bloqueio por tentativas fica na memória do servidor.** Funciona bem no computador local. Na Vercel cada instância teria sua própria contagem, mais um motivo para não cadastrar `TABLET_PIN` lá.
- **HTTP na rede local não é criptografado.** O PIN e os dados das clientes passam abertos pelo Wi-Fi. Use só na rede do salão ou de casa, com senha no Wi-Fi, e não abra essa porta para a internet no roteador.

## Testes

```bash
npm test
```

Cobrem as cinco ações e as trocas de status, a lista de ações permitidas, PIN errado e bloqueio por tentativas, CSRF, escape de HTML e conferem com o `acorn` (`ecmaVersion: 5`) que o script da página é ES5.
