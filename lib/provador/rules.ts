// Provador de tranças com IA: regras puras (sem banco e sem rede), usadas no servidor e nos testes.

/** Quantas fotos cada cliente cadastrada pode gerar sem a Helaine liberar mais. */
export const TRYON_FREE = 2;
/** Quantas fotos a mais a Helaine libera por clique no painel, e o teto por cliente. */
export const TRYON_GRANT = 2;
export const TRYON_EXTRA_MAX = 100;

export const tryonLimit = (extra: number) => TRYON_FREE + Math.max(0, Math.min(TRYON_EXTRA_MAX, Math.floor(extra) || 0));
export const tryonRemaining = (used: number, extra: number) => Math.max(0, tryonLimit(extra) - Math.max(0, used));

/**
 * Pedido para a IA. A primeira imagem é a foto da cliente; a segunda (quando existe) é o
 * modelo da trança. O texto insiste em não mexer no rosto: a prévia só vale se a cliente
 * se reconhecer nela.
 */
export function tryonPrompt(style: { name: string; description?: string }, hasReference: boolean): string {
  const detail = style.description ? ` (${style.description})` : '';
  return [
    `Edit the FIRST image, a photo of a real person. Change ONLY the hair so that the person wears this braided hairstyle: "${style.name}"${detail}.`,
    hasReference
      ? 'The SECOND image is the reference for the hairstyle: copy the braid pattern, thickness, parting and length from it. Do not copy the face, skin, clothes or background of the second image.'
      : 'Use a realistic, well-finished version of this hairstyle, as done in a professional braiding salon.',
    'Keep the person from the first image exactly the same: same face, facial features, expression, skin tone, age, body, clothes, pose, background and lighting. Do not beautify, slim, lighten or retouch the face or skin.',
    'The braids must look natural and photorealistic, attached at the scalp with a realistic hairline, matching the lighting of the photo.',
    'Return a single photorealistic image with the same framing as the first image. No text, no watermark, no collage, no side-by-side.',
  ].join(' ');
}

/** Nome do arquivo que a cliente baixa. */
export const tryonFileName = (serviceId: string) => `helaine-trancas-${serviceId.replace(/[^a-z0-9-]/g, '') || 'previa'}.png`;
