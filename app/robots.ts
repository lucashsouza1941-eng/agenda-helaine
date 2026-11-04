import type { MetadataRoute } from 'next';

// O painel e a página pessoal da cliente não aparecem no Google.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/meus-agendamentos'] } };
}
