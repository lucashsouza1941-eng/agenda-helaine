// Mural de fotos: tipos e regras puras (sem banco), usadas no servidor, no navegador e nos testes.

export type MuralPhoto = {
  id: string; path: string; caption: string; author: string;
  status: 'pendente' | 'aprovada'; source: 'cliente' | 'admin'; created_at: string;
};

export const MURAL_COLUMNS = 'id, path, caption, author, status, source, created_at';
export const PUBLIC_BUCKET = 'mural', PENDING_BUCKET = 'mural-pendente';

export const CAPTION_MAX = 120, AUTHOR_MAX = 40;
/** Tamanho máximo do arquivo que o servidor aceita (o navegador reduz a foto antes de enviar). */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
/** Lado maior da foto depois de reduzida, em pixels. */
export const MAX_PHOTO_SIDE = 1600;
/** Fila de espera: com tantas fotos pendentes, o site para de aceitar novas até a Helaine revisar. */
export const MAX_PENDING = 30;
/** Quantas fotos aprovadas a galeria mostra. */
export const GALLERY_LIMIT = 60;

/** Os primeiros bytes de todo arquivo JPEG. */
export const isJpeg = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

/** Por que uma foto enviada não serve (ou null se serve). */
export function photoProblem(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return 'Escolha uma foto.';
  if (bytes.length > MAX_PHOTO_BYTES) return 'A foto ficou grande demais. Tente outra foto.';
  if (!isJpeg(bytes)) return 'Não foi possível ler essa foto. Tente outra.';
  return null;
}

/** Texto de uma linha: sem quebras, sem espaços repetidos, cortado no limite. */
export const oneLine = (text: unknown, max: number) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Tamanho final de uma foto de `width` x `height` para caber em `max` no lado maior (nunca aumenta). */
export function fitSize(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Endereço público de uma foto aprovada. */
export const publicPhotoUrl = (supabaseUrl: string, path: string) => `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`;
