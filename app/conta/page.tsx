import { Shell } from '@/components/Shell';
import { ContaEntrar, ContaPerfil } from '@/components/ContaForms';
import { getCurrentClient } from '@/lib/cliente/session';

export const metadata = { title: 'Minha conta' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [client, { voltar }] = await Promise.all([getCurrentClient(), searchParams]);
  return <Shell><main className="page">
    <div className="page-title"><span className="eyebrow dark">Cliente</span><h1>Minha conta</h1>
      {!client && <p>Cadastre-se uma vez e o site passa a reconhecer você. O cadastro é opcional: dá para agendar sem ele.</p>}
    </div>
    {client ? <ContaPerfil client={client} /> : <ContaEntrar backTo={typeof voltar === 'string' ? voltar : ''} />}
  </main></Shell>;
}
