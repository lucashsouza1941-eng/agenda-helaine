import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SERVICE_PHOTOS, servicePhotoPath, services } from '@/lib/data';

describe('fotos dos serviços', () => {
  it('todo serviço listado tem o arquivo em public/, com tamanho razoável para celular', () => {
    for (const id of Object.keys(SERVICE_PHOTOS)) {
      const file = `public${servicePhotoPath(id)}`;
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeLessThan(200 * 1024);
    }
  });

  it('são 28: as 16 tranças e os 10 cortes novos, mais Tranças Chanel e Manutenção', () => {
    expect(Object.keys(SERVICE_PHOTOS)).toHaveLength(28);
  });

  it('o catálogo de reserva aponta para arquivos que existem', () => {
    for (const s of services) if (s.photo) expect(existsSync(`public${s.photo}`), s.photo).toBe(true);
  });
});
