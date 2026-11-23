import { Shell } from '@/components/Shell';
import { MuralForm } from '@/components/MuralForm';
import { getApprovedPhotos } from '@/lib/muralStore';

export const metadata = { title: 'Galeria de trabalhos' };
export const revalidate = 300;

export default async function Page() {
  const { photos, ready } = await getApprovedPhotos();
  return <Shell><main className="page">
    <div className="page-title"><span className="eyebrow dark">Inspiração</span><h1>Galeria de trabalhos</h1><p>Trabalhos da Helaine e fotos enviadas pelas clientes.</p></div>
    {photos.length === 0
      ? <div className="empty"><h2>Nenhuma foto ainda.</h2><p>{ready ? 'Seja a primeira a enviar a sua!' : 'As fotos chegam em breve.'}</p></div>
      : <div className="mural">{photos.map((p) => <figure key={p.id} className="mural-item">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt={p.caption || 'Trabalho da Helaine Tranças'} loading="lazy" decoding="async" />
          {(p.caption || p.author) && <figcaption>{p.caption}{p.author && <small>{p.caption ? ' · ' : ''}{p.author}</small>}</figcaption>}
        </figure>)}</div>}
    {ready && <section className="panel mural-send" id="enviar">
      <h2>Envie a sua foto</h2>
      <p className="muted">Fez as tranças com a Helaine? Mostre como ficou.</p>
      <MuralForm mode="cliente" />
    </section>}
  </main></Shell>;
}
