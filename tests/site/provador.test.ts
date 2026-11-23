import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRYON_FREE, tryonFileName, tryonLimit, tryonPrompt, tryonRemaining } from '@/lib/provador/rules';
import { generateTryon, tryonConfigured } from '@/lib/provador/gemini';

describe('limite do provador', () => {
  it('cada cliente começa com 2 fotos', () => {
    expect(TRYON_FREE).toBe(2);
    expect(tryonRemaining(0, 0)).toBe(2);
    expect(tryonRemaining(1, 0)).toBe(1);
    expect(tryonRemaining(2, 0)).toBe(0);
    expect(tryonRemaining(5, 0)).toBe(0);
  });

  it('a Helaine pode liberar mais, até um teto', () => {
    expect(tryonRemaining(2, 2)).toBe(2);
    expect(tryonLimit(1000)).toBe(102);
    expect(tryonLimit(-5)).toBe(2);
    expect(tryonLimit(Number.NaN)).toBe(2);
  });
});

describe('pedido para a IA', () => {
  it('manda mudar só o cabelo e não mexer no rosto', () => {
    const prompt = tryonPrompt({ name: 'Box Braids', description: 'Tranças soltas' }, true);
    expect(prompt).toContain('Box Braids');
    expect(prompt).toContain('Tranças soltas');
    expect(prompt).toMatch(/Change ONLY the hair/);
    expect(prompt).toMatch(/same face/);
    expect(prompt).toMatch(/SECOND image is the reference/);
  });

  it('sem foto-modelo, não fala em segunda imagem', () => {
    expect(tryonPrompt({ name: 'Nagô' }, false)).not.toMatch(/SECOND image/);
  });

  it('nome do arquivo baixado é seguro', () => {
    expect(tryonFileName('box-braids')).toBe('helaine-trancas-box-braids.png');
    expect(tryonFileName('../../x')).toBe('helaine-trancas-x.png');
    expect(tryonFileName('')).toBe('helaine-trancas-previa.png');
  });
});

describe('ligação com a IA', () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.GEMINI_API_KEY; });
  const input = { photo: new Uint8Array([0xff, 0xd8, 0xff, 1]), reference: new Uint8Array([0xff, 0xd8, 0xff, 2]), style: { name: 'Box Braids' } };
  const answer = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it('sem a chave, o provador fica desligado', () => {
    expect(tryonConfigured()).toBe(false);
    process.env.GEMINI_API_KEY = 'k';
    expect(tryonConfigured()).toBe(true);
  });

  it('manda a foto da cliente, a foto-modelo e a chave, e devolve a imagem', async () => {
    process.env.GEMINI_API_KEY = 'chave-secreta';
    const fetchMock = answer(200, { candidates: [{ content: { parts: [{ text: 'pronto' }, { inlineData: { mimeType: 'image/png', data: 'QUJD' } }] } }] });
    vi.stubGlobal('fetch', fetchMock);
    expect(await generateTryon(input)).toEqual({ ok: true, mime: 'image/png', base64: 'QUJD' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(':generateContent');
    expect(url).not.toContain('chave-secreta'); // a chave vai no cabeçalho, nunca no endereço
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('chave-secreta');
    const parts = JSON.parse(String(init.body)).contents[0].parts;
    expect(parts).toHaveLength(3);
    expect(parts[1].inline_data.mime_type).toBe('image/jpeg');
  });

  it('resposta sem imagem conta como recusada; erro do serviço conta como erro', async () => {
    process.env.GEMINI_API_KEY = 'k';
    vi.stubGlobal('fetch', answer(200, { candidates: [{ content: { parts: [{ text: 'não posso' }] }, finishReason: 'SAFETY' }] }));
    expect(await generateTryon(input)).toEqual({ ok: false, reason: 'recusada' });
    vi.stubGlobal('fetch', answer(429, { error: { message: 'quota' } }));
    expect(await generateTryon(input)).toEqual({ ok: false, reason: 'erro' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede'); }));
    expect(await generateTryon(input)).toEqual({ ok: false, reason: 'erro' });
  });
});
