import type { Metadata, Viewport } from 'next';
import './globals.css';

const description = 'Tranças com atendimento cuidadoso. Escolha o serviço, a data e o horário e agende online, sem precisar criar conta.';
// Na Vercel, o endereço de produção vem desta variável; sem ela, os links da prévia ficam relativos ao localhost.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Helaine Tranças | Agendamento online', template: '%s | Helaine Tranças' },
  description,
  openGraph: { title: 'Helaine Tranças', description, siteName: 'Helaine Tranças', locale: 'pt_BR', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#4d135f' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  );
}
