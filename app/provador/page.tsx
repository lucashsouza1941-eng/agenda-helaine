import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { Provador } from '@/components/Provador';
import { getActiveServices } from '@/lib/settings';
import { supabaseConfigured } from '@/lib/supabase/server';
import { getCurrentClient } from '@/lib/cliente/session';
import { tryonConfigured } from '@/lib/provador/gemini';
import { getTryonUsage } from '@/lib/provador/usage';
import { TRYON_FREE, tryonRemaining } from '@/lib/provador/rules';
import { helaineWhatsAppLink } from '@/lib/whatsapp';

export const metadata = { title: 'Provador de tranças' };
export const dynamic = 'force-dynamic';
// A IA leva de 10 a 40 segundos para devolver a foto.
export const maxDuration = 60;

export default async function Page() {
  // Página escondida até a chave NEXT_PUBLIC_PROVADOR=on ser ligada: nem o endereço direto abre.
  if (process.env.NEXT_PUBLIC_PROVADOR !== 'on') notFound();
  const client = await getCurrentClient();
  const ready = supabaseConfigured() && tryonConfigured();
  const [services, usage] = await Promise.all([getActiveServices(), client && ready ? getTryonUsage(client.id) : null]);
  const styles = services.filter((s) => s.category === 'tranca').map((s) => ({ id: s.id, name: s.name, photo: s.photo ?? null, photoPosition: s.photoPosition ?? null, image: s.image }));

  return <Shell><main className="page provador">
    <div className="page-title"><span className="eyebrow dark">Novidade</span><h1>Provador de tranças</h1>
      <p>Escolha um modelo, mande uma foto sua e veja uma prévia de como a trança ficaria em você. Depois é só baixar e mandar para a Helaine.</p>
    </div>
    {!ready || (client && !usage) ? <div className="empty"><h2>Em breve por aqui.</h2><p>O provador ainda está sendo preparado. Enquanto isso, veja os modelos e agende seu horário.</p><Link className="btn gold" href="/servicos">Ver os modelos →</Link></div>
      : !client ? <div className="empty"><h2>Entre para experimentar</h2><p>O provador é para clientes cadastradas. O cadastro é rápido (nome, telefone e e-mail) e dá direito a {TRYON_FREE} fotos.</p><Link className="btn gold" href="/conta?voltar=/provador">Fazer cadastro ou entrar →</Link></div>
      : <Provador styles={styles} firstName={client.name.split(' ')[0]} initialRemaining={tryonRemaining(usage!.used, usage!.extra)} whatsapp={helaineWhatsAppLink()} />}
  </main></Shell>;
}
