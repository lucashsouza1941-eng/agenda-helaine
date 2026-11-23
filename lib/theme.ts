export const THEME_KEY = 'ht-tema';

/**
 * Roda antes de a página aparecer (no <head>), para o site já abrir no modo certo,
 * sem piscar: usa a escolha guardada no aparelho ou, se não houver, o modo do aparelho.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;
