import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));

import { checkNewPin, checkSignup, formatPhone, isFullName, isWeakPin, lockedMinutes, loginCheck, normalizePhone } from '@/lib/cliente/rules';
import { CLIENT_SESSION_SECONDS, createClientToken, hashPin, readClientToken, verifyPin } from '@/lib/cliente/session';

const ID = '3f2b8c1e-5a4d-4e6f-9a7b-0c1d2e3f4a5b';
beforeAll(() => { process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste'; });

describe('telefone', () => {
  it('aceita os jeitos comuns de escrever e guarda só os dígitos com DDD', () => {
    for (const typed of ['(11) 95858-1395', '11958581395', '+55 11 95858-1395', '5511958581395', '011 95858 1395']) {
      expect(normalizePhone(typed)).toBe('11958581395');
    }
    expect(normalizePhone('(11) 3333-4444')).toBe('1133334444');
  });

  it('recusa telefone sem DDD, curto, longo ou vazio', () => {
    for (const typed of ['95858-1395', '123', '119585813950000', '', null, undefined, 'abc']) expect(normalizePhone(typed)).toBeNull();
  });

  it('mostra formatado', () => {
    expect(formatPhone('11958581395')).toBe('(11) 95858-1395');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
  });
});

describe('cadastro', () => {
  const ok = { name: '  Maria   da Silva ', phone: '(11) 95858-1395', email: ' Maria@Email.COM ', pin: '' };

  it('limpa os dados e deixa a senha opcional', () => {
    expect(checkSignup(ok)).toEqual({ ok: true, data: { name: 'Maria da Silva', phone: '11958581395', email: 'maria@email.com', pin: '' } });
    expect(checkSignup({ ...ok, pin: '2580' })).toMatchObject({ ok: true, data: { pin: '2580' } });
  });

  it('pede nome completo, telefone com DDD e e-mail válido', () => {
    expect(isFullName('Maria')).toBe(false);
    expect(checkSignup({ ...ok, name: 'Maria' }).ok).toBe(false);
    expect(checkSignup({ ...ok, phone: '95858-1395' }).ok).toBe(false);
    expect(checkSignup({ ...ok, email: 'maria@' }).ok).toBe(false);
    expect(checkSignup({ ...ok, email: '' }).ok).toBe(false);
  });

  it('a senha tem exatamente 4 números e não pode ser óbvia', () => {
    for (const pin of ['123', '12345', '12a4', 'abcd']) expect(checkNewPin(pin, true).ok).toBe(false);
    for (const pin of ['1234', '0000', '7777', '4321']) { expect(isWeakPin(pin)).toBe(true); expect(checkNewPin(pin, true).ok).toBe(false); }
    expect(checkNewPin('2580', true)).toEqual({ ok: true, data: '2580' });
    expect(checkNewPin('', false).ok).toBe(false);
  });
});

describe('entrar', () => {
  it('quem tem senha só entra com a senha (o e-mail não serve)', () => {
    const client = { email: 'maria@email.com', hasPin: true };
    expect(loginCheck(client, '2580', true)).toBe(true);
    expect(loginCheck(client, '1111', false)).toBe(false);
    expect(loginCheck(client, 'maria@email.com', false)).toBe(false);
  });

  it('quem não tem senha entra com o e-mail do cadastro', () => {
    const client = { email: 'maria@email.com', hasPin: false };
    expect(loginCheck(client, ' MARIA@email.com ', false)).toBe(true);
    expect(loginCheck(client, 'outra@email.com', false)).toBe(false);
    expect(loginCheck(client, '', false)).toBe(false);
  });

  it('bloqueio conta os minutos que faltam', () => {
    const now = Date.parse('2026-11-23T12:00:00Z');
    expect(lockedMinutes(null, now)).toBe(0);
    expect(lockedMinutes('2026-11-23T11:59:00Z', now)).toBe(0);
    expect(lockedMinutes('2026-11-23T12:14:30Z', now)).toBe(15);
  });
});

describe('senha guardada', () => {
  it('confere a certa, recusa a errada e nunca guarda a senha em si', () => {
    const stored = hashPin('2580');
    expect(stored).not.toContain('2580');
    expect(verifyPin('2580', stored)).toBe(true);
    expect(verifyPin('2581', stored)).toBe(false);
    expect(hashPin('2580')).not.toBe(stored); // sal diferente a cada vez
  });

  it('recusa quando não há senha ou o valor guardado é inválido', () => {
    for (const stored of [null, '', 'texto', 'scrypt$$', 'md5$a$b']) expect(verifyPin('2580', stored)).toBe(false);
  });
});

describe('cookie da cliente', () => {
  it('reconhece o próprio cookie', () => {
    expect(readClientToken(createClientToken(ID))).toBe(ID);
  });

  it('recusa cookie adulterado, de outra cliente, vencido ou malformado', () => {
    const now = Date.now(), token = createClientToken(ID, now);
    const [id, expires, signature] = token.split('.');
    const other = ID.replace('3f2b', '0000');
    expect(readClientToken(`${other}.${expires}.${signature}`)).toBeNull();
    expect(readClientToken(`${id}.${Number(expires) + 999}.${signature}`)).toBeNull();
    expect(readClientToken(`${id}.${expires}.${'0'.repeat(64)}`)).toBeNull();
    expect(readClientToken(token, now + (CLIENT_SESSION_SECONDS + 60) * 1000)).toBeNull();
    for (const bad of [undefined, null, '', 'abc', `${id}.${expires}`, `${token}.extra`, 'x'.repeat(500)]) expect(readClientToken(bad)).toBeNull();
  });

  it('sem a chave do servidor ninguém entra, e trocar a chave derruba os cookies antigos', () => {
    const token = createClientToken(ID);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'outra-chave';
    expect(readClientToken(token)).toBeNull();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(readClientToken(createClientToken(ID))).toBeNull();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste';
  });
});
