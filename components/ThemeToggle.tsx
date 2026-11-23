'use client';
import { useEffect, useState } from 'react';

import { THEME_KEY as KEY } from '@/lib/theme';

type Theme = 'light' | 'dark';

/** Botão do topo: troca entre modo claro e escuro e guarda a escolha neste aparelho. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'); }, []);
  const toggle = () => {
    const next: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* sem localStorage: vale só nesta visita */ }
    setTheme(next);
  };
  const label = theme === 'dark' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro';
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>{theme === 'dark' ? '☀' : '☾'}</button>;
}
