import type { MetadataRoute } from 'next';

// Deixa o site instalável como aplicativo (ícone na tela inicial, abre em tela cheia).
// Não há service worker de propósito: a agenda muda o tempo todo e nada deve ser
// servido de uma cópia guardada no aparelho.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Helaine Tranças',
    short_name: 'Helaine',
    description: 'Agende seu horário de tranças, cortes e outros serviços com a Helaine.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#4b0076',
    theme_color: '#4b0076',
    categories: ['beauty', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Agendar horário', short_name: 'Agendar', url: '/agendar' },
      { name: 'Meus agendamentos', short_name: 'Agendamentos', url: '/meus-agendamentos' },
    ],
  };
}
