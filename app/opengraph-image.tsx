import { ImageResponse } from 'next/og';

export const alt = 'Helaine Tranças — agende seu horário online';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Prévia que aparece ao compartilhar o link (WhatsApp, Instagram, Facebook).
export default function OpengraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 90px', background: 'linear-gradient(135deg,#160b1e,#3a1245 55%,#120b18)', color: 'white' }}>
      <svg width="84" height="84" viewBox="10 12 44 44"><path d="M14 44h36l3-22-11 9-10-15-10 15-11-9z" fill="#f5bb22" /><rect x="14" y="47" width="36" height="5" rx="2" fill="#f5bb22" /></svg>
      <div style={{ fontSize: 110, color: '#f5bb22', lineHeight: 1, marginTop: 10 }}>Helaine</div>
      <div style={{ fontSize: 30, letterSpacing: 18, color: '#f5bb22', marginTop: 14 }}>TRANÇAS</div>
      <div style={{ fontSize: 46, marginTop: 56, fontWeight: 700 }}>Agende seu horário online</div>
      <div style={{ fontSize: 30, marginTop: 14, color: '#e5dae7' }}>Box braids, nagô, twist e mais — sem precisar criar conta.</div>
    </div>,
    size,
  );
}
