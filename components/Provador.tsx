'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createTryon } from '@/app/provador/actions';
import { Turnstile } from '@/components/Turnstile';
import { resizeToJpeg } from '@/lib/resizePhoto';
import { tryonFileName } from '@/lib/provador/rules';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
type Style = { id: string; name: string; photo: string | null; photoPosition: string | null; image: string };

/** Provador: escolher o modelo, mandar a foto, ver a prévia feita pela IA e baixar. */
export function Provador({ styles, firstName, initialRemaining, whatsapp }: { styles: Style[]; firstName: string; initialRemaining: number; whatsapp: string | null }) {
  const [styleId, setStyleId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [consent, setConsent] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ image: string; styleId: string } | null>(null);
  const [captcha, setCaptcha] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [canShare, setCanShare] = useState(false);
  const [pending, startTransition] = useTransition();
  const resultRef = useRef<HTMLDivElement>(null);
  const style = styles.find((s) => s.id === styleId);
  const resultStyle = styles.find((s) => s.id === result?.styleId);

  useEffect(() => { setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'); }, []);
  useEffect(() => { if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [result]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f); setError('');
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return f ? URL.createObjectURL(f) : ''; });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!style) { setError('Escolha um modelo de trança.'); return; }
    if (!file) { setError('Escolha uma foto sua.'); return; }
    if (!consent) { setError('Marque a caixinha de autorização para continuar.'); return; }
    if (TURNSTILE_SITE_KEY && !captcha) { setError('Aguarde a verificação anti-spam terminar.'); return; }
    startTransition(async () => {
      let small: Blob;
      try { small = await resizeToJpeg(file); }
      catch { setError('Não foi possível ler essa foto. Tente outra, em JPG ou PNG.'); return; }
      const data = new FormData();
      data.set('style', style.id); data.set('photo', small, 'foto.jpg'); data.set('consent', 'on'); data.set('captcha', captcha);
      let r;
      try { r = await createTryon({ error: '', image: '', remaining: null }, data); }
      catch { setError('A foto demorou demais para ficar pronta. Tente de novo em alguns minutos.'); setCaptchaReset((n) => n + 1); return; }
      setCaptchaReset((n) => n + 1);
      if (r.remaining !== null) setRemaining(r.remaining);
      if (r.error) { setError(r.error); return; }
      setResult({ image: r.image, styleId: style.id });
    });
  };

  const share = async () => {
    if (!result) return;
    try {
      const blob = await (await fetch(result.image)).blob();
      const shared = new File([blob], tryonFileName(result.styleId), { type: blob.type });
      const payload = { files: [shared], text: `Olá, Helaine! Fiz essa prévia no provador do site com ${resultStyle?.name ?? 'essa trança'}. O que você acha?` };
      if (navigator.canShare(payload)) await navigator.share(payload);
      else setError('Seu aparelho não deixa compartilhar a foto direto. Baixe a foto e envie pelo WhatsApp.');
    } catch { /* a cliente fechou a janela de compartilhar */ }
  };

  return <div className="provador-grid">
    <form className="panel" onSubmit={submit}>
      <p className={remaining > 0 ? 'promo-note on' : 'form-error'} role="status">{firstName}, {remaining > 0 ? <>você tem <b>{remaining}</b> {remaining === 1 ? 'foto' : 'fotos'} para criar.</> : 'você já usou suas fotos do provador. Fale com a Helaine se quiser testar outro estilo.'}</p>

      <h2>1. Escolha o modelo</h2>
      <div className="style-grid" role="radiogroup" aria-label="Modelo de trança">
        {styles.map((s) => <button type="button" key={s.id} role="radio" aria-checked={styleId === s.id} className={styleId === s.id ? 'style-card active' : 'style-card'} onClick={() => { setStyleId(s.id); setError(''); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="style-photo" style={{ background: s.image }}>{s.photo && <img src={s.photo} alt="" loading="lazy" style={{ objectPosition: s.photoPosition ?? undefined }} />}</span>
          <b>{s.name}</b>
        </button>)}
      </div>

      <h2>2. Mande uma foto sua</h2>
      <label>Foto de frente, com o rosto e o cabelo aparecendo, em lugar claro<input type="file" accept="image/*" onChange={onFile} /></label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && <img className="provador-preview" src={preview} alt="Sua foto escolhida" />}
      <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> A foto é minha (ou de quem me autorizou) e aceito que ela seja enviada a um serviço de inteligência artificial do Google só para criar a prévia. O site não guarda a foto.</label>

      {TURNSTILE_SITE_KEY && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setCaptcha} resetKey={captchaReset} />}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn gold full" disabled={pending || remaining === 0}>{pending ? 'Criando sua foto... (até 1 minuto)' : 'Criar minha foto →'}</button>
      <p className="muted small">A prévia é feita por inteligência artificial e serve só para dar uma ideia. O resultado no salão pode ser diferente, e a IA às vezes muda detalhes do rosto.</p>
    </form>

    <div className="panel provador-result" ref={resultRef} aria-live="polite">
      <h2>Sua prévia</h2>
      {pending ? <div className="provador-wait"><span className="spinner" aria-hidden="true" /><p>A IA está trançando... não feche esta página.</p></div>
        : result ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="provador-image" src={result.image} alt={`Prévia com ${resultStyle?.name ?? 'a trança escolhida'}`} />
          <p className="muted small">Prévia feita por IA com <b>{resultStyle?.name}</b>. Baixe agora: o site não guarda a foto, e ela some se você sair desta página.</p>
          <div className="actions">
            <a className="btn gold" href={result.image} download={tryonFileName(result.styleId)}>Baixar foto ↓</a>
            {canShare && <button type="button" className="btn whatsapp" onClick={share}>Enviar para a Helaine</button>}
            {!canShare && whatsapp && <a className="btn whatsapp" href={whatsapp} target="_blank" rel="noreferrer">Abrir WhatsApp da Helaine</a>}
          </div>
          {!canShare && whatsapp && <p className="muted small">Neste aparelho, baixe a foto e anexe na conversa do WhatsApp.</p>}
          <Link className="text-link" href={`/agendar?servico=${result.styleId}`}>Gostei! Agendar {resultStyle?.name} →</Link>
        </> : <p className="muted">Sua foto com a trança aparece aqui.</p>}
    </div>
  </div>;
}
