import type { Metadata } from 'next';
import './globals.css';
import { BookingProvider } from '@/components/BookingProvider';

export const metadata: Metadata = {
  title: 'Helaine Tranças | Agendamento',
  description: 'Agendamento online Helaine Tranças',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <BookingProvider>{children}</BookingProvider>
      </body>
    </html>
  );
}
