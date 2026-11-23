import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // O mural recebe fotos por Server Action. O navegador reduz a foto antes de enviar
  // (até 2 MB); o padrão do Next, 1 MB, barraria fotos válidas.
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  // O provador lê as fotos-modelo das tranças no servidor para mandar à IA.
  outputFileTracingIncludes: { '/provador': ['./public/images/servicos/*.jpg'] },
};

export default nextConfig;
