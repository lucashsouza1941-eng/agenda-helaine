'use server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { headers } from 'next/headers';
import { createServiceClient, supabaseConfigured } from '@/lib/supabase/server';
import { getActiveServices } from '@/lib/settings';
import { turnstileConfigured, verifyTurnstile } from '@/lib/turnstile';
import { MAX_PHOTO_BYTES, photoProblem } from '@/lib/mural';
import { SERVICE_PHOTOS } from '@/lib/data';
import { getCurrentClient } from '@/lib/cliente/session';
import { generateTryon, tryonConfigured } from '@/lib/provador/gemini';
import { tryonLimit, tryonRemaining } from '@/lib/provador/rules';
import { getTryonUsage } from '@/lib/provador/usage';

export type TryonState = { error: string; image: string; remaining: number | null };
const fail = (error: string, remaining: number | null = null): TryonState => ({ error, image: '', remaining });

const OFF = 'O provador ainda não está ligado. Tente mais tarde.';
const CAPTCHA = 'Não conseguimos confirmar que você não é um robô. Marque a verificação de novo, por favor.';
const NO_MORE = 'Você já usou suas fotos do provador. Fale com a Helaine se quiser testar outro estilo.';

/** Foto-modelo da trança, que vai junto para a IA. Sem ela, a IA recebe só o nome do estilo. */
async function referencePhoto(serviceId: string): Promise<Uint8Array | null> {
  if (!(serviceId in SERVICE_PHOTOS)) return null;
  try { return new Uint8Array(await readFile(path.join(process.cwd(), 'public', 'images', 'servicos', `${serviceId}.jpg`))); }
  catch { return null; }
}

/**
 * Gera a prévia: a foto da cliente com a trança escolhida. Só para cliente cadastrada e
 * dentro do limite. A foto não é guardada em lugar nenhum: volta direto para o navegador.
 */
export async function createTryon(_prev: TryonState, formData: FormData): Promise<TryonState> {
  if (process.env.NEXT_PUBLIC_PROVADOR !== 'on' || !supabaseConfigured() || !tryonConfigured()) return fail(OFF);
  const client = await getCurrentClient();
  if (!client) return fail('Entre na sua conta para usar o provador.');
  if (formData.get('consent') !== 'on') return fail('Marque a caixinha de autorização para continuar.');

  const serviceId = String(formData.get('style') ?? '');
  const style = (await getActiveServices()).find((s) => s.id === serviceId && s.category === 'tranca');
  if (!style) return fail('Escolha um modelo de trança.');

  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return fail('Escolha uma foto sua.');
  if (file.size > MAX_PHOTO_BYTES) return fail('A foto ficou grande demais. Tente outra foto.');
  const photo = new Uint8Array(await file.arrayBuffer());
  const problem = photoProblem(photo);
  if (problem) return fail(problem);

  if (turnstileConfigured()) {
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0].trim();
    if (!(await verifyTurnstile(String(formData.get('captcha') ?? ''), ip))) return fail(CAPTCHA);
  }

  const before = await getTryonUsage(client.id);
  if (!before) return fail(OFF);
  if (tryonRemaining(before.used, before.extra) === 0) return fail(NO_MORE, 0);

  // Reserva a vez ANTES de chamar a IA (que custa dinheiro) e confere de novo: dois pedidos
  // ao mesmo tempo não passam do limite. Se a IA falhar, a vez é devolvida.
  const supabase = createServiceClient();
  const { data: use, error: useError } = await supabase.from('tryon_uses').insert({ client_id: client.id, service_id: style.id }).select('id').single();
  if (useError || !use) { console.error('createTryon', useError); return fail('Não foi possível criar a foto agora. Tente novamente.'); }
  const giveBack = () => supabase.from('tryon_uses').delete().eq('id', use.id);
  const after = await getTryonUsage(client.id);
  if (!after || after.used > tryonLimit(after.extra)) {
    await giveBack();
    return after ? fail(NO_MORE, 0) : fail('Não foi possível criar a foto agora. Tente novamente.');
  }

  const result = await generateTryon({ photo, reference: await referencePhoto(style.id), style: { name: style.name, description: style.description } });
  if (!result.ok) {
    await giveBack();
    return fail(result.reason === 'recusada'
      ? 'A IA não conseguiu usar essa foto. Tente outra: de frente, com o rosto e o cabelo aparecendo, bem iluminada. Essa tentativa não foi descontada.'
      : 'Não foi possível criar a foto agora. Tente de novo em alguns minutos. Essa tentativa não foi descontada.', tryonRemaining(before.used, before.extra));
  }
  return { error: '', image: `data:${result.mime};base64,${result.base64}`, remaining: tryonRemaining(after.used, after.extra) };
}
