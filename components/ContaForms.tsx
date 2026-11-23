'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { loginClient, logoutClient, registerClient, updateProfile, type AccountState } from '@/app/conta/actions';
import { CLIENT_CHANGED } from '@/components/AccountLink';
import { Turnstile } from '@/components/Turnstile';
import { formatPhone, PIN_LENGTH, type Client } from '@/lib/cliente/rules';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const EMPTY: AccountState = { error: '', ok: '' };
/** Para onde a cliente pode voltar depois de entrar (só páginas do próprio site). */
const BACK_TO = ['/agendar', '/meus-agendamentos'];

const pinProps = { inputMode: 'numeric' as const, pattern: `[0-9]{${PIN_LENGTH}}`, maxLength: PIN_LENGTH, autoComplete: 'off' };

/** Envia um formulário para uma ação do servidor, com a verificação anti-spam quando ligada. */
function useAccountForm(action: (prev: AccountState, data: FormData) => Promise<AccountState>, opts: { captcha: boolean; onOk?: () => void }) {
  const [state, setState] = useState(EMPTY);
  const [captcha, setCaptcha] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [pending, startTransition] = useTransition();
  const needsCaptcha = opts.captcha && Boolean(TURNSTILE_SITE_KEY);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (needsCaptcha && !captcha) { setState({ error: 'Aguarde a verificação anti-spam terminar.', ok: '' }); return; }
    data.set('captcha', captcha);
    startTransition(async () => {
      const result = await action(EMPTY, data);
      setState(result);
      setCaptchaReset((n) => n + 1); // cada verificação vale um envio só
      if (result.ok) { window.dispatchEvent(new Event(CLIENT_CHANGED)); opts.onOk?.(); }
    });
  };
  const footer = <>
    {needsCaptcha && <Turnstile siteKey={TURNSTILE_SITE_KEY!} onToken={setCaptcha} resetKey={captchaReset} />}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.ok && <p className="form-ok" role="status">{state.ok}</p>}
  </>;
  return { onSubmit, pending, footer };
}

/** Cadastro e entrada, para quem ainda não está logada neste aparelho. */
export function ContaEntrar({ backTo }: { backTo: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<'cadastro' | 'entrar'>('cadastro');
  const [noPin, setNoPin] = useState(false);
  const done = () => { if (BACK_TO.includes(backTo)) router.push(backTo); else router.refresh(); };
  const signup = useAccountForm(registerClient, { captcha: true, onOk: done });
  const login = useAccountForm(loginClient, { captcha: true, onOk: done });

  return <div className="conta">
    <div className="conta-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === 'cadastro'} className={tab === 'cadastro' ? 'active' : ''} onClick={() => setTab('cadastro')}>Quero me cadastrar</button>
      <button type="button" role="tab" aria-selected={tab === 'entrar'} className={tab === 'entrar' ? 'active' : ''} onClick={() => setTab('entrar')}>Já tenho cadastro</button>
    </div>
    {tab === 'cadastro' ? <form key="cadastro" className="panel" onSubmit={signup.onSubmit}>
      <h2>Criar meu cadastro</h2>
      <p className="muted small">Só três informações. Depois disso este aparelho já reconhece você e seus dados vêm preenchidos na hora de agendar.</p>
      <label>Nome completo<input name="name" required maxLength={120} autoComplete="name" placeholder="Nome e sobrenome" /></label>
      <label>Telefone (WhatsApp)<input name="phone" required type="tel" maxLength={30} autoComplete="tel" placeholder="(11) 99999-9999" /></label>
      <label>E-mail<input name="email" required type="email" maxLength={160} autoComplete="email" placeholder="seu@email.com" /></label>
      <label>Senha de {PIN_LENGTH} números (opcional)<input name="pin" {...pinProps} placeholder="Ex.: 2580" /></label>
      <p className="muted small">A senha serve para entrar na sua conta em outro celular. Sem senha, você entra com o telefone e o e-mail do cadastro.</p>
      {signup.footer}
      <button className="btn gold full" disabled={signup.pending}>{signup.pending ? 'Salvando...' : 'Criar cadastro'}</button>
    </form> : <form key="entrar" className="panel" onSubmit={login.onSubmit}>
      <h2>Entrar na minha conta</h2>
      <label>Telefone do cadastro<input name="phone" required type="tel" maxLength={30} autoComplete="tel" placeholder="(11) 99999-9999" /></label>
      {noPin
        ? <label>E-mail do cadastro<input key="email" name="secret" required type="email" maxLength={160} autoComplete="email" placeholder="seu@email.com" /></label>
        : <label>Senha de {PIN_LENGTH} números<input key="pin" name="secret" required type="password" {...pinProps} placeholder="••••" /></label>}
      <p className="muted small"><button type="button" className="conta-link" onClick={() => setNoPin((v) => !v)}>{noPin ? 'Tenho senha de 4 números' : 'Não criei senha'}</button> · Esqueceu a senha? Fale com a Helaine.</p>
      {login.footer}
      <button className="btn gold full" disabled={login.pending}>{login.pending ? 'Entrando...' : 'Entrar'}</button>
    </form>}
  </div>;
}

/** Dados da cliente logada: alterar nome, e-mail e senha, ou sair. */
export function ContaPerfil({ client }: { client: Client }) {
  const router = useRouter();
  const profile = useAccountForm(updateProfile, { captcha: false, onOk: () => router.refresh() });
  const [leaving, startLeaving] = useTransition();
  const firstName = client.name.split(' ')[0];

  return <div className="conta">
    <div className="panel conta-ola">
      <h2>Olá, {firstName}! 👋</h2>
      <p className="muted">Este aparelho já reconhece você. Seus dados vêm preenchidos na hora de agendar e seus agendamentos ficam guardados na sua conta.</p>
      <div className="actions"><Link className="btn gold" href="/agendar">Agendar horário →</Link><Link className="btn ghost-dark" href="/meus-agendamentos">Meus agendamentos</Link></div>
    </div>
    <form className="panel" onSubmit={profile.onSubmit}>
      <h2>Meus dados</h2>
      <label>Nome completo<input name="name" required maxLength={120} defaultValue={client.name} autoComplete="name" /></label>
      <label>Telefone (WhatsApp)<input value={formatPhone(client.phone)} readOnly disabled /></label>
      <p className="muted small">O telefone é o seu login. Para trocar, fale com a Helaine.</p>
      <label>E-mail<input name="email" required type="email" maxLength={160} defaultValue={client.email} autoComplete="email" /></label>
      <label>{client.hasPin ? `Trocar a senha de ${PIN_LENGTH} números (deixe em branco para manter)` : `Criar senha de ${PIN_LENGTH} números (opcional)`}<input name="pin" {...pinProps} placeholder="Ex.: 2580" /></label>
      {!client.hasPin && <p className="muted small">Você ainda não tem senha. Com ela, só você entra na sua conta em outro aparelho.</p>}
      {profile.footer}
      <button className="btn gold" disabled={profile.pending}>{profile.pending ? 'Salvando...' : 'Salvar'}</button>
    </form>
    <button type="button" className="conta-link" disabled={leaving} onClick={() => startLeaving(async () => { await logoutClient(); window.dispatchEvent(new Event(CLIENT_CHANGED)); router.refresh(); })}>{leaving ? 'Saindo...' : 'Sair da conta neste aparelho'}</button>
  </div>;
}
