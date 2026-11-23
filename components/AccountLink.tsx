'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export const CLIENT_CHANGED = 'cliente-mudou';

/** Primeiro nome da cliente logada neste aparelho ('' se não houver). Só para exibir. */
export function useClientName(): string {
  const [name, setName] = useState('');
  useEffect(() => {
    const read = () => {
      const raw = document.cookie.split('; ').find((c) => c.startsWith('cliente_nome='))?.slice('cliente_nome='.length) ?? '';
      try { setName(decodeURIComponent(raw)); } catch { setName(''); }
    };
    read();
    // Avisado pelos formulários da conta quando a cliente entra, sai ou muda o nome.
    window.addEventListener(CLIENT_CHANGED, read);
    return () => window.removeEventListener(CLIENT_CHANGED, read);
  }, []);
  return name;
}

/** Link do menu: "Minha conta" ou "Olá, Maria". */
export function AccountLink() {
  const name = useClientName();
  return <Link href="/conta">{name ? `Olá, ${name}` : 'Minha conta'}</Link>;
}
