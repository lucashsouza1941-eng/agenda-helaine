'use client';
import { useEffect, useState } from 'react';

// Evento do Chrome/Edge (Android e computador) que permite abrir a janela de instalação.
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
// iPhone e iPad (o iPad novo se apresenta como Mac com tela de toque).
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Botão "Instalar aplicativo". Some se o site já está instalado ou se o navegador não instala. */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    setIos(isIOS());
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPromptEvent); };
    const onInstalled = () => { setPrompt(null); setInstalled(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (installed) return <div className="install-app"><p role="status">Aplicativo instalado. Procure o ícone da coroa na tela inicial.</p></div>;

  if (prompt) {
    const install = async () => {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      // O navegador só deixa usar o mesmo evento uma vez.
      setPrompt(null);
      if (outcome === 'accepted') setInstalled(true);
    };
    return <div className="install-app">
      <div><b>Tenha a agenda no seu celular</b><span>Instale o aplicativo e agende com um toque, sem procurar o site.</span></div>
      <button className="btn gold" onClick={install}>Instalar aplicativo</button>
    </div>;
  }

  // No iPhone não existe janela de instalação: quem instala é a própria pessoa, pelo Safari.
  if (ios) return <div className="install-app">
    <div><b>Tenha a agenda no seu iPhone</b><span>Coloque o ícone da Helaine Tranças na tela de início.</span></div>
    <button className="btn gold" onClick={() => setShowIosHelp((v) => !v)} aria-expanded={showIosHelp}>Instalar aplicativo</button>
    {showIosHelp && <ol className="install-steps">
      <li>Abra este site no <b>Safari</b>.</li>
      <li>Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).</li>
      <li>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</li>
    </ol>}
  </div>;

  return null;
}
