import Link from 'next/link';import {AccountLink} from '@/components/AccountLink';import {ThemeToggle} from '@/components/ThemeToggle';
// O provador de tranças só aparece no menu quando esta chave está ligada na Vercel.
const PROVADOR_ON=process.env.NEXT_PUBLIC_PROVADOR==='on';
export function Shell({children}:{children:React.ReactNode}){
 return <><header className="top"><Link href="/" className="brand"><img src="/logo/simbolo.png" alt="" width="133" height="240"/><span><b>Helaine</b><small>TRANÇAS</small></span></Link><nav><Link href="/servicos">Serviços</Link><Link href="/agendar">Agendar</Link>{PROVADOR_ON&&<Link href="/provador">Provador IA</Link>}<Link href="/galeria">Galeria</Link><Link href="/meus-agendamentos">Meus agendamentos</Link><AccountLink/><Link href="/admin">Admin</Link></nav><ThemeToggle/></header>{children}<footer><div className="brand"><img src="/logo/simbolo.png" alt="" width="133" height="240"/><span><b>Helaine</b><small>TRANÇAS</small></span></div><p>Beleza, identidade e ancestralidade.</p></footer></>
}
