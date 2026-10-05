import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Helaine Tranças | Agendamento',
  description: 'Agendamento online Helaine Tranças',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  );
}
