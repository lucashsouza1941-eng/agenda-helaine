'use client';
import { useEffect, useRef } from 'react';

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC; s.async = true; s.onload = () => resolve(); s.onerror = () => { loading = null; reject(new Error('turnstile')); };
    document.head.appendChild(s);
  });
  return loading;
}

/** Widget anti-spam da Cloudflare. `resetKey` muda → gera um token novo (cada token vale uma vez). */
export function Turnstile({ siteKey, onToken, resetKey }: { siteKey: string; onToken: (t: string) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null), id = useRef<string | null>(null), cb = useRef(onToken);
  cb.current = onToken;
  useEffect(() => {
    let alive = true;
    loadScript().then(() => {
      if (!alive || !box.current || !window.turnstile) return;
      id.current = window.turnstile.render(box.current, {
        sitekey: siteKey, language: 'pt-br',
        callback: (t: string) => cb.current(t),
        'expired-callback': () => cb.current(''),
        'error-callback': () => cb.current(''),
      });
    }).catch(() => console.error('Não foi possível carregar o Turnstile.'));
    return () => { alive = false; if (id.current) window.turnstile?.remove(id.current); id.current = null; };
  }, [siteKey]);
  useEffect(() => { if (resetKey && id.current) { cb.current(''); window.turnstile?.reset(id.current); } }, [resetKey]);
  return <div ref={box} className="captcha" />;
}
