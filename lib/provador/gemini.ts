import { tryonPrompt } from '@/lib/provador/rules';

// Liga com a IA de imagem do Google (Gemini). A chave fica só no servidor.
// GEMINI_API_KEY: chave criada no Google AI Studio. Sem ela, o provador fica desligado.
// GEMINI_IMAGE_MODEL: troca o modelo sem mexer no código (o Google renomeia os modelos de vez em quando).

const key = () => process.env.GEMINI_API_KEY ?? '';
const model = () => process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const base = () => (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');

export const tryonConfigured = () => Boolean(key());

export type TryonResult =
  | { ok: true; mime: string; base64: string }
  /** 'recusada': a IA não quis editar essa foto. 'erro': falha de rede, chave ou modelo. */
  | { ok: false; reason: 'recusada' | 'erro' };

type Part = { text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } };
type GeminiResponse = { candidates?: { content?: { parts?: Part[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string }; error?: { message?: string } };

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

/** Pede à IA a foto da cliente com a trança escolhida. `reference` é a foto-modelo da trança. */
export async function generateTryon(input: { photo: Uint8Array; reference: Uint8Array | null; style: { name: string; description?: string } }): Promise<TryonResult> {
  const parts: object[] = [
    { text: tryonPrompt(input.style, Boolean(input.reference)) },
    { inline_data: { mime_type: 'image/jpeg', data: b64(input.photo) } },
  ];
  if (input.reference) parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64(input.reference) } });
  try {
    const res = await fetch(`${base()}/v1beta/models/${encodeURIComponent(model())}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key() },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
      signal: AbortSignal.timeout(50000),
    });
    const data = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) { console.error('generateTryon', res.status, data.error?.message); return { ok: false, reason: 'erro' }; }
    for (const part of data.candidates?.[0]?.content?.parts ?? []) {
      const image = part.inlineData ?? (part.inline_data && { mimeType: part.inline_data.mime_type, data: part.inline_data.data });
      if (image?.data) return { ok: true, mime: /^image\/(png|jpeg|webp)$/.test(image.mimeType ?? '') ? image.mimeType! : 'image/png', base64: image.data };
    }
    // Respondeu sem imagem: a IA recusou (filtro de segurança) ou só escreveu texto.
    console.warn('generateTryon sem imagem', data.promptFeedback?.blockReason, data.candidates?.[0]?.finishReason);
    return { ok: false, reason: 'recusada' };
  } catch (err) {
    console.error('generateTryon', err);
    return { ok: false, reason: 'erro' };
  }
}
