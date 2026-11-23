import { describe, expect, it } from 'vitest';
import { fitSize, isJpeg, MAX_PHOTO_BYTES, oneLine, photoProblem, publicPhotoUrl } from '@/lib/mural';

const jpeg = (size: number) => { const b = new Uint8Array(size); b.set([0xff, 0xd8, 0xff, 0xe0]); return b; };

describe('arquivo de foto', () => {
  it('aceita JPEG', () => {
    expect(isJpeg(jpeg(100))).toBe(true);
    expect(photoProblem(jpeg(100))).toBeNull();
    expect(photoProblem(jpeg(MAX_PHOTO_BYTES))).toBeNull();
  });

  it('recusa o que não é JPEG, mesmo com nome ou tipo de imagem', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const html = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    for (const bytes of [png, html, svg, new Uint8Array([0xff, 0xd8]), new Uint8Array([0, 0, 0, 0, 0])]) {
      expect(isJpeg(bytes)).toBe(false);
      expect(photoProblem(bytes)).toMatch(/Não foi possível ler/);
    }
  });

  it('recusa arquivo vazio e arquivo acima de 2 MB', () => {
    expect(photoProblem(new Uint8Array(0))).toBe('Escolha uma foto.');
    expect(photoProblem(jpeg(MAX_PHOTO_BYTES + 1))).toMatch(/grande demais/);
  });
});

describe('legenda e nome', () => {
  it('vira uma linha só, sem espaços sobrando, cortada no limite', () => {
    expect(oneLine('  Box braids\n\nfinalizadas   em 6h  ', 120)).toBe('Box braids finalizadas em 6h');
    expect(oneLine('x'.repeat(200), 120)).toHaveLength(120);
    expect(oneLine(null, 40)).toBe('');
    expect(oneLine(undefined, 40)).toBe('');
  });
});

describe('tamanho da foto reduzida', () => {
  it('lado maior cai para 1600, mantendo a proporção', () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitSize(4000, 2250, 1280)).toEqual({ width: 1280, height: 720 });
  });

  it('foto pequena não é aumentada', () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('nunca dá lado zero', () => {
    expect(fitSize(10000, 2)).toEqual({ width: 1600, height: 1 });
  });
});

describe('endereço público', () => {
  it('aponta para a pasta pública do Storage', () => {
    expect(publicPhotoUrl('https://abc.supabase.co/', 'f.jpg')).toBe('https://abc.supabase.co/storage/v1/object/public/mural/f.jpg');
    expect(publicPhotoUrl('https://abc.supabase.co', 'f.jpg')).toBe('https://abc.supabase.co/storage/v1/object/public/mural/f.jpg');
  });
});
