import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getAgenda } from '@/app/admin/tablet/route';
import { POST as postLogin } from '@/app/admin/tablet/login/route';
import { POST as postAcao } from '@/app/admin/tablet/acao/route';
import { POST as postSair } from '@/app/admin/tablet/sair/route';
import { createSession, MAX_FAILS_PER_IP, resetLoginLimiterForTests } from '@/lib/tablet/auth';
import { setTabletRepoForTests, TabletError } from '@/lib/tablet/repo';
import { actionFields, booking, cookieHeader, get, ID, memoryRepo, PIN, post, session, setEnv } from './helpers';

// "Agora" fixo: sexta, 20/11/2026, 12:30 em São Paulo.
const NOW = new Date('2026-11-20T15:30:00.000Z');
let m: ReturnType<typeof memoryRepo>;

beforeEach(() => {
  setEnv();
  resetLoginLimiterForTests();
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  m = memoryRepo([
    booking(1, '09:00', 'Finalizado'),
    booking(2, '11:00', 'Confirmado'),
    booking(3, '14:00', 'Pendente'),
    booking(4, '16:00', 'Confirmado'),
    booking(5, '17:00', 'Cancelado'),
    booking(6, '09:00', 'Pendente', { date: '2026-11-21' }),
  ]);
  setTabletRepoForTests(m.repo);
});
afterEach(() => { vi.useRealTimers(); setTabletRepoForTests(null); });

const location = (r: Response) => r.headers.get('location');
const snapshot = () => m.rows.map((r) => `${r.id}:${r.status}:${r.reminder_sent_at}`).join('|');

describe('login por PIN', () => {
  it('sem TABLET_PIN o painel responde 503 e não mostra nada', async () => {
    delete process.env.TABLET_PIN;
    const r = await getAgenda(get('/admin/tablet', session()));
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain('Cliente 2');
    expect((await postLogin(post('/admin/tablet/login', { pin: '' }))).status).toBe(503);
  });

  it('sem sessão mostra a tela de PIN, sem dados da agenda', async () => {
    const r = await getAgenda(get('/admin/tablet'));
    const body = await r.text();
    expect(r.status).toBe(200);
    expect(body).toContain('name="pin"');
    expect(body).not.toContain('Cliente');
    expect(m.calls).toEqual([]);
  });

  it('PIN errado: 401, sem cookie', async () => {
    const r = await postLogin(post('/admin/tablet/login', { pin: '000000' }));
    expect(r.status).toBe(401);
    expect(r.headers.get('set-cookie')).toBeNull();
    expect(await r.text()).toContain('PIN incorreto');
  });

  it('PIN certo: 303 para o painel com cookie HttpOnly de 1 ano só em /admin/tablet', async () => {
    const r = await postLogin(post('/admin/tablet/login', { pin: PIN }));
    expect(r.status).toBe(303);
    expect(location(r)).toBe('/admin/tablet');
    const cookie = r.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^tablet_session=\d+\.[0-9a-f]{64}; /);
    expect(cookie).toContain('Path=/admin/tablet');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Max-Age=31536000');
    expect(cookie).not.toContain('Secure'); // HTTP na rede local
    expect(cookie).not.toContain(PIN);

    const value = cookie.split(';')[0].split('=')[1];
    const page = await getAgenda(get('/admin/tablet', value));
    expect(await page.text()).toContain('Cliente 2');
  });

  it('em HTTPS o cookie leva Secure', async () => {
    const r = await postLogin(post('/admin/tablet/login', { pin: PIN }, undefined, { 'x-forwarded-proto': 'https' }));
    expect(r.headers.get('set-cookie')).toContain('Secure');
  });

  it(`depois de ${MAX_FAILS_PER_IP} erros bloqueia (429), até com o PIN certo`, async () => {
    for (let i = 0; i < MAX_FAILS_PER_IP; i++) expect((await postLogin(post('/admin/tablet/login', { pin: `${i}${i}${i}${i}` }))).status).toBe(401);
    const r = await postLogin(post('/admin/tablet/login', { pin: PIN }));
    expect(r.status).toBe(429);
    expect(r.headers.get('set-cookie')).toBeNull();
    expect(await r.text()).toContain('Muitas tentativas');
    // 10 minutos depois volta a aceitar.
    vi.setSystemTime(new Date(NOW.getTime() + 10 * 60 * 1000 + 1000));
    expect((await postLogin(post('/admin/tablet/login', { pin: PIN }))).status).toBe(303);
  });

  it('login vindo de outro site é recusado', async () => {
    const r = await postLogin(post('/admin/tablet/login', { pin: PIN }, undefined, { origin: 'http://site-malicioso.example' }));
    expect(r.status).toBe(403);
    expect(r.headers.get('set-cookie')).toBeNull();
  });

  it('cookie forjado, vencido ou de outro PIN cai na tela de PIN', async () => {
    const real = session();
    const expired = createSession(NOW.getTime() - 366 * 24 * 3600 * 1000);
    for (const fake of ['1.abc', PIN, `${real}x`, `9999999999.${'a'.repeat(64)}`, expired]) {
      const body = await (await getAgenda(get('/admin/tablet', fake))).text();
      expect(body).toContain('name="pin"');
      expect(body).not.toContain('Cliente');
    }
  });

  it('sair apaga o cookie', async () => {
    const s = session();
    const r = await postSair(post('/admin/tablet/sair', { csrf: actionFields(s, 1, 'x').csrf }, s));
    expect(r.status).toBe(303);
    expect(r.headers.get('set-cookie')).toMatch(/^tablet_session=; .*Max-Age=0/);
  });
});

describe('lista do dia', () => {
  it('sem data mostra hoje (fuso de São Paulo); data inválida também cai em hoje', async () => {
    const s = session();
    for (const path of ['/admin/tablet', '/admin/tablet?data=2026-13-45', '/admin/tablet?data=<script>', '/admin/tablet?data=2026-02-30']) {
      const body = await (await getAgenda(get(path, s))).text();
      expect(body).toContain('Hoje · Sexta-feira, 20 de novembro de 2026');
      expect(body).not.toContain('<script>"');
    }
    expect(m.calls.every((c) => c === 'listDay 2026-11-20')).toBe(true);
  });

  it('vira o dia pelo fuso de São Paulo, não pelo UTC', async () => {
    vi.setSystemTime(new Date('2026-11-21T02:30:00.000Z')); // 23:30 do dia 20 em São Paulo
    expect(await (await getAgenda(get('/admin/tablet', session()))).text()).toContain('Hoje · Sexta-feira, 20 de novembro');
  });

  it('outro dia: mostra só os agendamentos dele', async () => {
    const body = await (await getAgenda(get('/admin/tablet?data=2026-11-21', session()))).text();
    expect(body).toContain('Sábado, 21 de novembro de 2026');
    expect(body).not.toContain('Hoje ·');
    expect(body).toContain('Cliente 6');
    expect(body).not.toContain('Cliente 2');
    expect(body).toContain('href="/admin/tablet?data=2026-11-20"');
    expect(body).toContain('href="/admin/tablet?data=2026-11-22"');
  });

  it('mensagem: só códigos conhecidos viram texto', async () => {
    const s = session();
    expect(await (await getAgenda(get('/admin/tablet?ok=confirmar', s))).text()).toContain('Atendimento confirmado.');
    expect(await (await getAgenda(get('/admin/tablet?erro=csrf', s))).text()).toContain('Por segurança');
    const body = await (await getAgenda(get('/admin/tablet?ok=%3Cb%3Eoi&erro=toString', s))).text();
    expect(body).not.toContain('<b>oi');
    expect(body).not.toContain('class="msg');
  });

  it('banco fora do ar: 503, sem vazar detalhes', async () => {
    setTabletRepoForTests({ ...m.repo, listDay: async () => { throw new TabletError('banco'); } });
    const r = await getAgenda(get('/admin/tablet', session()));
    expect(r.status).toBe(503);
    expect(await r.text()).toContain('Não foi possível falar com o banco');
  });

  it('respostas não ficam em cache nem em iframe', async () => {
    const r = await getAgenda(get('/admin/tablet', session()));
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('x-frame-options')).toBe('DENY');
    expect(r.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });
});

describe('POST /admin/tablet/acao', () => {
  it('cada ação muda o status e volta com 303 para a lista', async () => {
    const s = session();
    const run = async (n: number, acao: string, data?: string) => postAcao(post('/admin/tablet/acao', actionFields(s, n, acao, data), s));

    let r = await run(3, 'confirmar');
    expect(r.status).toBe(303);
    expect(location(r)).toBe('/admin/tablet?ok=confirmar'); // hoje: sem data na URL
    expect(m.find(3).status).toBe('Confirmado');

    r = await run(2, 'finalizar');
    expect(location(r)).toBe('/admin/tablet?ok=finalizar');
    expect(m.find(2).status).toBe('Finalizado');

    r = await run(4, 'cancelar');
    expect(location(r)).toBe('/admin/tablet?ok=cancelar');
    expect(m.find(4).status).toBe('Cancelado');

    r = await run(5, 'reabrir');
    expect(location(r)).toBe('/admin/tablet?ok=reabrir');
    expect(m.find(5).status).toBe('Pendente');

    r = await run(6, 'lembrete', '2026-11-21');
    expect(location(r)).toBe('/admin/tablet?data=2026-11-21&ok=lembrete_registrado'); // outro dia: volta para ele
    expect(m.find(6).reminder_sent_at).toBe(NOW.toISOString());
    const body = await (await getAgenda(get('/admin/tablet?data=2026-11-21', s))).text();
    expect(body).toContain('lembrete registrado 12:30');
    expect(body).toContain('Reenviar lembrete');
  });

  it('confirmar o que já está confirmado: erro, nada muda', async () => {
    const s = session(), before = snapshot();
    const r = await postAcao(post('/admin/tablet/acao', actionFields(s, 2, 'confirmar'), s));
    expect(location(r)).toBe('/admin/tablet?erro=status');
    expect(snapshot()).toBe(before);
  });

  it('sem sessão ou com sessão forjada: vai para o PIN e nada muda', async () => {
    const s = session(), before = snapshot();
    for (const cookie of [undefined, '1.abc', `${s}0`]) {
      const r = await postAcao(post('/admin/tablet/acao', actionFields(s, 3, 'cancelar'), cookie));
      expect(r.status).toBe(303);
      expect(location(r)).toBe('/admin/tablet');
    }
    expect(snapshot()).toBe(before);
    expect(m.calls).toEqual([]);
  });

  it('CSRF: sem token, token errado ou token de outra sessão não executa', async () => {
    const s = session(), before = snapshot();
    const other = createSession(NOW.getTime() - 5000);
    const fields = actionFields(s, 3, 'cancelar');
    for (const csrf of [undefined, '', 'abc', actionFields(other, 3, 'cancelar').csrf]) {
      const body: Record<string, string> = { ...fields };
      if (csrf === undefined) delete body.csrf; else body.csrf = csrf;
      const r = await postAcao(post('/admin/tablet/acao', body, s));
      expect(location(r)).toBe('/admin/tablet?erro=csrf');
    }
    expect(snapshot()).toBe(before);
    expect(m.calls).toEqual([]);
  });

  it('POST vindo de outro site (Origin diferente) não executa, mesmo com token certo', async () => {
    const s = session(), before = snapshot();
    const r = await postAcao(post('/admin/tablet/acao', actionFields(s, 3, 'cancelar'), s, { origin: 'http://site-malicioso.example' }));
    expect(location(r)).toBe('/admin/tablet?erro=csrf');
    expect(snapshot()).toBe(before);
  });

  it('whitelist: ação desconhecida não executa nada', async () => {
    const s = session(), before = snapshot();
    for (const acao of ['apagar', 'delete', 'Confirmado', 'CONFIRMAR', '', 'constructor', '__proto__', 'confirmar;cancelar']) {
      const r = await postAcao(post('/admin/tablet/acao', actionFields(s, 3, acao), s));
      expect(location(r)).toBe('/admin/tablet?erro=acao');
    }
    expect(snapshot()).toBe(before);
    expect(m.calls).toEqual([]);
  });

  it('id inválido não chega ao banco', async () => {
    const s = session();
    for (const id of ['', '1', "' or 1=1 --", '../x', `${ID(3)} `, `${ID(3)},${ID(4)}`]) {
      const r = await postAcao(post('/admin/tablet/acao', { ...actionFields(s, 3, 'cancelar'), id }, s));
      expect(location(r)).toBe('/admin/tablet?erro=id');
    }
    expect(m.calls).toEqual([]);
  });

  it('id que não existe', async () => {
    const s = session();
    const r = await postAcao(post('/admin/tablet/acao', actionFields(s, 77, 'finalizar'), s));
    expect(location(r)).toBe('/admin/tablet?erro=nao_encontrado');
  });

  it('data inválida no formulário não entra no redirect', async () => {
    const s = session();
    for (const data of ['2026-99-99', 'x&erro=y', '//evil.example', '']) {
      const r = await postAcao(post('/admin/tablet/acao', actionFields(s, 3, 'confirmar', data), s));
      expect(location(r)).toMatch(/^\/admin\/tablet\?(ok|erro)=[a-z_]+$/);
    }
  });

  it('reabrir em cima de outro atendimento: erro claro, nada muda', async () => {
    m.rows.push(booking(8, '17:00', 'Pendente'));
    const s = session();
    const r = await postAcao(post('/admin/tablet/acao', actionFields(s, 5, 'reabrir'), s));
    expect(location(r)).toBe('/admin/tablet?erro=ocupado');
    expect(m.find(5).status).toBe('Cancelado');
  });

  it('falta de migração vira mensagem, não erro 500', async () => {
    setTabletRepoForTests({ ...m.repo, transition: async () => { throw new TabletError('migracao'); } });
    const s = session();
    const r = await postAcao(post('/admin/tablet/acao', actionFields(s, 3, 'finalizar'), s));
    expect(location(r)).toBe('/admin/tablet?erro=migracao');
  });

  it('corpo que não é formulário ou é grande demais é recusado', async () => {
    const s = session(), before = snapshot();
    const json = new Request('http://192.168.0.10:3000/admin/tablet/acao', {
      method: 'POST', headers: { cookie: cookieHeader(s), 'content-type': 'application/json' }, body: JSON.stringify(actionFields(s, 3, 'cancelar')),
    });
    expect(location(await postAcao(json))).toBe('/admin/tablet?erro=csrf');
    const big = await postAcao(post('/admin/tablet/acao', { ...actionFields(s, 3, 'cancelar'), lixo: 'x'.repeat(10000) }, s));
    expect(location(big)).toBe('/admin/tablet?erro=csrf');
    expect(snapshot()).toBe(before);
  });
});
