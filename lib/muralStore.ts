import { randomUUID } from 'node:crypto';
import { createServiceClient, supabaseConfigured } from '@/lib/supabase/server';
import { isMissingTable } from '@/lib/settings';
import { GALLERY_LIMIT, MAX_PENDING, MURAL_COLUMNS, PENDING_BUCKET, PUBLIC_BUCKET, publicPhotoUrl, type MuralPhoto } from '@/lib/mural';

// Mural no Supabase: linhas em mural_photos e arquivos no Storage. Tudo pelo servidor,
// com a service role key. Quem chama é que confere se a pessoa pode (cliente ou admin).

export type MuralPhotoWithUrl = MuralPhoto & { url: string };
const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const withPublicUrl = (p: MuralPhoto): MuralPhotoWithUrl => ({ ...p, url: publicPhotoUrl(supabaseUrl(), p.path) });

/** Fotos aprovadas, da mais nova para a mais antiga. `ready` é false antes da migração 0010. */
export async function getApprovedPhotos(limit = GALLERY_LIMIT): Promise<{ photos: MuralPhotoWithUrl[]; ready: boolean }> {
  if (!supabaseConfigured()) return { photos: [], ready: false };
  const { data, error } = await createServiceClient().from('mural_photos').select(MURAL_COLUMNS)
    .eq('status', 'aprovada').order('approved_at', { ascending: false }).limit(limit).returns<MuralPhoto[]>();
  if (error || !data) { if (!isMissingTable(error)) console.error('getApprovedPhotos', error); return { photos: [], ready: false }; }
  return { photos: data.map(withPublicUrl), ready: true };
}

/** Para o /admin: fotos esperando aprovação (com link temporário, pois a pasta é privada) e as aprovadas. */
export async function getMuralForAdmin(): Promise<{ pending: MuralPhotoWithUrl[]; approved: MuralPhotoWithUrl[]; ready: boolean }> {
  if (!supabaseConfigured()) return { pending: [], approved: [], ready: false };
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('mural_photos').select(MURAL_COLUMNS).order('created_at', { ascending: false }).limit(200).returns<MuralPhoto[]>();
  if (error || !data) { if (!isMissingTable(error)) console.error('getMuralForAdmin', error); return { pending: [], approved: [], ready: false }; }
  const waiting = data.filter((p) => p.status === 'pendente');
  const signed = waiting.length ? await supabase.storage.from(PENDING_BUCKET).createSignedUrls(waiting.map((p) => p.path), 3600) : { data: [], error: null };
  if (signed.error) console.error('getMuralForAdmin signed', signed.error);
  const urlOf = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  return {
    pending: waiting.map((p) => ({ ...p, url: urlOf.get(p.path) ?? '' })),
    approved: data.filter((p) => p.status === 'aprovada').map(withPublicUrl),
    ready: true,
  };
}

export type SaveResult = { ok: true } | { ok: false; reason: 'fila' | 'migracao' | 'erro' };

/** Guarda uma foto nova. De cliente entra como pendente (pasta privada); de admin já entra aprovada. */
export async function savePhoto(input: { bytes: Uint8Array; caption: string; author: string; source: 'cliente' | 'admin' }): Promise<SaveResult> {
  const supabase = createServiceClient();
  const approved = input.source === 'admin';
  if (!approved) {
    const { count, error } = await supabase.from('mural_photos').select('id', { count: 'exact', head: true }).eq('status', 'pendente');
    if (error) { console.error('savePhoto count', error); return { ok: false, reason: isMissingTable(error) ? 'migracao' : 'erro' }; }
    if ((count ?? 0) >= MAX_PENDING) return { ok: false, reason: 'fila' };
  }
  const path = `${randomUUID()}.jpg`, bucket = approved ? PUBLIC_BUCKET : PENDING_BUCKET;
  const upload = await supabase.storage.from(bucket).upload(path, input.bytes, { contentType: 'image/jpeg', upsert: false });
  if (upload.error) { console.error('savePhoto upload', upload.error); return { ok: false, reason: 'erro' }; }
  const { error } = await supabase.from('mural_photos').insert({
    path, caption: input.caption, author: input.author, source: input.source,
    status: approved ? 'aprovada' : 'pendente', approved_at: approved ? new Date().toISOString() : null,
  });
  if (error) {
    console.error('savePhoto insert', error);
    await supabase.storage.from(bucket).remove([path]); // não deixa arquivo sem linha no banco
    return { ok: false, reason: isMissingTable(error) ? 'migracao' : 'erro' };
  }
  return { ok: true };
}

/** Aprova: copia o arquivo da pasta privada para a pública e marca a foto como aprovada. */
export async function approvePhoto(id: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data: photo, error } = await supabase.from('mural_photos').select(MURAL_COLUMNS).eq('id', id).eq('status', 'pendente').returns<MuralPhoto[]>().maybeSingle();
  if (error || !photo) { if (error) console.error('approvePhoto', error); return false; }
  const file = await supabase.storage.from(PENDING_BUCKET).download(photo.path);
  if (file.error || !file.data) { console.error('approvePhoto download', file.error); return false; }
  const copy = await supabase.storage.from(PUBLIC_BUCKET).upload(photo.path, new Uint8Array(await file.data.arrayBuffer()), { contentType: 'image/jpeg', upsert: true });
  if (copy.error) { console.error('approvePhoto upload', copy.error); return false; }
  const update = await supabase.from('mural_photos').update({ status: 'aprovada', approved_at: new Date().toISOString() }).eq('id', id).eq('status', 'pendente');
  if (update.error) {
    console.error('approvePhoto update', update.error);
    await supabase.storage.from(PUBLIC_BUCKET).remove([photo.path]); // desfaz: a foto não fica pública sem estar aprovada
    return false;
  }
  await supabase.storage.from(PENDING_BUCKET).remove([photo.path]);
  return true;
}

/** Recusa uma pendente ou remove uma aprovada: apaga a linha e o arquivo. */
export async function deletePhoto(id: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data: photo, error } = await supabase.from('mural_photos').select(MURAL_COLUMNS).eq('id', id).returns<MuralPhoto[]>().maybeSingle();
  if (error || !photo) { if (error) console.error('deletePhoto', error); return false; }
  // Primeiro a linha: a foto some do site na hora, mesmo se o arquivo demorar a sair.
  const removed = await supabase.from('mural_photos').delete().eq('id', id);
  if (removed.error) { console.error('deletePhoto', removed.error); return false; }
  const files = await supabase.storage.from(photo.status === 'aprovada' ? PUBLIC_BUCKET : PENDING_BUCKET).remove([photo.path]);
  if (files.error) console.error('deletePhoto file', files.error);
  return true;
}
