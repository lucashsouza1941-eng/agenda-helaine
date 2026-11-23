import Link from 'next/link';import {SiteNav} from '@/components/SiteNav';import {ThemeToggle} from '@/components/ThemeToggle';
export function Shell({children}:{children:React.ReactNode}){
 return <><header className="top"><Link href="/" className="brand"><img src="/logo/simbolo.png" alt="" width="133" height="240"/><span><b>Helaine</b><small>TRANÇAS</small></span></Link><SiteNav/><ThemeToggle/></header>{children}<footer><div className="brand"><img src="/logo/simbolo.png" alt="" width="133" height="240"/><span><b>Helaine</b><small>TRANÇAS</small></span></div><p>Beleza, identidade e ancestralidade.</p></footer></>
}
