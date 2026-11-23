'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useClientName } from '@/components/AccountLink';

// O provador de tranças só aparece no menu quando esta chave está ligada na Vercel.
const PROVADOR_ON = process.env.NEXT_PUBLIC_PROVADOR === 'on';

/**
 * Menu do topo. Marca a página em que a pessoa está e, no celular (onde o menu rola
 * para os lados), traz o item marcado para o meio da tela.
 */
export function SiteNav() {
  const pathname = usePathname();
  const name = useClientName();
  const nav = useRef<HTMLElement>(null);
  const links = [
    { href: '/servicos', label: 'Serviços' },
    { href: '/agendar', label: 'Agendar' },
    ...(PROVADOR_ON ? [{ href: '/provador', label: 'Provador IA' }] : []),
    { href: '/galeria', label: 'Galeria' },
    { href: '/meus-agendamentos', label: 'Meus agendamentos' },
    { href: '/conta', label: name ? `Olá, ${name}` : 'Minha conta' },
    { href: '/admin', label: 'Admin' },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // Centraliza rolando só o menu (scrollIntoView poderia rolar a página junto).
  const center = (el: HTMLElement | null | undefined, smooth: boolean) => {
    const box = nav.current;
    if (!box || !el) return;
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
  };
  useEffect(() => { center(nav.current?.querySelector<HTMLElement>('[aria-current="page"]'), false); }, [pathname, name]);

  return <nav ref={nav} aria-label="Menu principal">
    {links.map((l) => <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? 'page' : undefined} onClick={(e) => center(e.currentTarget, true)}>{l.label}</Link>)}
  </nav>;
}
