import type { Metadata, Viewport } from 'next';
import '@fontsource/anton/latin-400.css';
import '@fontsource/dm-serif-display/latin-400.css';
import './globals.css';
import './street.css';
import './spacing.css';
import { THEME_SCRIPT } from '@/lib/theme';

const description = 'Tranças com atendimento cuidadoso. Escolha o serviço, a data e o horário e agende online, sem precisar criar conta.';
// Na Vercel, o endereço de produção vem desta variável; sem ela, os links da prévia ficam relativos ao localhost.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Helaine Tranças | Agendamento online', template: '%s | Helaine Tranças' },
  description,
  openGraph: { title: 'Helaine Tranças', description, siteName: 'Helaine Tranças', locale: 'pt_BR', type: 'website' },
  // Ícone e nome do site quando instalado na tela de início do iPhone (o manifesto cobre o Android).
  icons: { apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Helaine', statusBarStyle: 'default' },
};

export const viewport: Viewport = { themeColor: '#4b0076' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>
        {children}
      </body>
    </html>
  );
}
