import Link from 'next/link';
export function Shell({children}:{children:React.ReactNode}){
 return <><header className="top"><Link href="/" className="brand"><span className="crown">♕</span><span><b>Helaine</b><small>TRANÇAS</small></span></Link><nav><Link href="/servicos">Serviços</Link><Link href="/agendar">Agendar</Link><Link href="/galeria">Galeria</Link><Link href="/meus-agendamentos">Meus agendamentos</Link><Link href="/admin">Admin</Link></nav></header>{children}<footer><div className="brand"><span className="crown">♕</span><span><b>Helaine</b><small>TRANÇAS</small></span></div><p>Beleza, identidade e ancestralidade.</p></footer></>
}
