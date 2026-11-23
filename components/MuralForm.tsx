'use client';
import { useRef, useState, useTransition } from 'react';
import { submitMuralPhoto } from '@/app/actions';
import { addMuralPhoto } from '@/app/admin/actions';
import { Turnstile } from '@/components/Turnstile';
import { AUTHOR_MAX, CAPTION_MAX } from '@/lib/mural';
import { resizeToJpeg } from '@/lib/resizePhoto';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Envio de foto para o mural. `mode` "cliente": vai para a fila de aprovação.
 * "admin": publica direto (usado no painel).
 */
export function MuralForm({ mode }: { mode: 'cliente' | 'admin' }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, setState] = useState({ error: '', ok: '' });
  const [preview, setPreview] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [pending, startTransition] = useTransition();
  const isClient = mode === 'cliente';
  const needsCaptcha = isClient && Boolean(TURNSTILE_SITE_KEY);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return file ? URL.createObjectURL(file) : ''; });
    setState({ error: '', ok: '' });
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const file = data.get('photo');
    if (!(file instanceof File) || file.size === 0) { setState({ error: 'Escolha uma foto.', ok: '' }); return; }
    if (needsCaptcha && !captcha) { setState({ error: 'Aguarde a verificação anti-spam terminar.', ok: '' }); return; }
    startTransition(async () => {
      let small: Blob;
      try { small = await resizeToJpeg(file); }
      catch { setState({ error: 'Não foi possível ler essa foto. Tente outra, em JPG ou PNG.', ok: '' }); return; }
      data.set('photo', small, 'foto.jpg');
      data.set('captcha', captcha);
      const result = await (isClient ? submitMuralPhoto : addMuralPhoto)({ error: '', ok: '' }, data);
      setState(result);
      setCaptchaReset((n) => n + 1); // cada verificação vale um envio só
      if (result.ok) { form.current?.reset(); setPreview((old) => { if (old) URL.revokeObjectURL(old); return ''; }); }
    });
  };

  return <form ref={form} onSubmit={submit} className="mural-form">
    <label>Foto<input name="photo" type="file" accept="image/*" required onChange={onFile} /></label>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {preview && <img className="mural-preview" src={preview} alt="Prévia da foto escolhida" />}
    <label>Legenda (opcional)<input name="caption" maxLength={CAPTION_MAX} placeholder="Ex.: Box braids finalizadas em 6h" /></label>
    {isClient && <label>Seu nome (opcional)<input name="author" maxLength={AUTHOR_MAX} placeholder="Como você quer aparecer" /></label>}
    {isClient && <label className="check"><input type="checkbox" name="consent" required /> A foto é minha, ou tenho autorização de quem aparece nela, e aceito que ela fique no site.</label>}
    {needsCaptcha && <Turnstile siteKey={TURNSTILE_SITE_KEY!} onToken={setCaptcha} resetKey={captchaReset} />}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.ok && <p className="form-ok" role="status">{state.ok}</p>}
    <button className="btn gold" disabled={pending}>{pending ? 'Enviando...' : isClient ? 'Enviar foto' : 'Publicar na galeria'}</button>
    {isClient && <p className="muted small">A foto aparece na galeria depois que a Helaine aprovar.</p>}
  </form>;
}
