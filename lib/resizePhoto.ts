import { fitSize, MAX_PHOTO_BYTES } from '@/lib/mural';

// Roda no navegador. Foto de celular tem de 3 a 8 MB; aqui ela é redesenhada num
// canvas, menor e em JPEG. De quebra, isso apaga os dados escondidos da foto
// (como o local onde foi tirada), que não devem ir para um mural público.

const STEPS: [side: number, quality: number][] = [[1600, 0.82], [1280, 0.75], [1024, 0.65]];

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('imagem'));
    img.src = url;
  });
}

/** Reduz uma foto para JPEG com no máximo 1600 px de lado, até caber no limite de envio. */
export async function resizeToJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await load(url);
    for (const [side, quality] of STEPS) {
      const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, side);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#fff'; // fundo branco para imagens com transparência
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_PHOTO_BYTES * 0.9) return blob;
    }
    throw new Error('grande');
  } finally {
    URL.revokeObjectURL(url);
  }
}
