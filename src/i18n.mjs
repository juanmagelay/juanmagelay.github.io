// Languages of the site. English is the original and lives at the root, with no prefix.
// Spanish (Argentina, with vos) lives under /es/ and Portuguese (Brazil) under /pt/, with the same paths:
// /writing/x/, /es/writing/x/ and /pt/writing/x/ are the same page. Issue #11.
import { site } from './site.config.mjs';

/** @typedef {'en' | 'es' | 'pt'} Lang */

/** @type {Lang[]} */
export const LANGS = ['en', 'es', 'pt'];
/** @type {Lang} */
export const DEFAULT_LANG = 'en';

// htmlLang names the variant for screen readers and hyphenation. Links and hreflang use the plain code.
export const languages = {
  en: { name: 'English', htmlLang: 'en', locale: 'en-US', ogLocale: 'en_US' },
  es: { name: 'Español', htmlLang: 'es-AR', locale: 'es-AR', ogLocale: 'es_AR' },
  pt: { name: 'Português', htmlLang: 'pt-BR', locale: 'pt-BR', ogLocale: 'pt_BR' },
};

/**
 * The language of a site path: /es/writing/ is es, /writing/ is en.
 * @param {string} pathname
 * @returns {Lang}
 */
export function langFromPath(pathname) {
  const first = /** @type {Lang} */ (pathname.split('/')[1]);
  return LANGS.includes(first) ? first : DEFAULT_LANG;
}

/**
 * The path without its language prefix: /es/writing/x/ becomes /writing/x/.
 * @param {string} pathname
 */
export function unlocalizePath(pathname) {
  const lang = langFromPath(pathname);
  return lang === DEFAULT_LANG ? pathname : pathname.slice(lang.length + 1) || '/';
}

/**
 * The same path in another language: localizePath('/writing/', 'es') is /es/writing/.
 * @param {string} pathname
 * @param {Lang} lang
 */
export function localizePath(pathname, lang) {
  const path = unlocalizePath(pathname);
  return lang === DEFAULT_LANG ? path : `/${lang}${path}`;
}

/**
 * The route param for a language in src/pages/[...lang]/: undefined for English, so it stays at the root.
 * @param {Lang} lang
 */
export function langParam(lang) {
  return lang === DEFAULT_LANG ? undefined : lang;
}

// The CV each version links to. There is no Portuguese CV, so the Portuguese site offers the English one.
const CVS = {
  en: { href: site.cvPath, download: site.cvDownloadName },
  es: { href: site.cvSpanishPath, download: site.cvSpanishDownloadName },
};
/** @type {Record<Lang, 'en' | 'es'>} */
const CV_LANG = { en: 'en', es: 'es', pt: 'en' };

/**
 * The CV link for a page in this language, with the language of the file.
 * @param {Lang} lang
 */
export function cvFor(lang) {
  const language = CV_LANG[lang];
  return { ...CVS[language], language };
}

// Interface copy. Post text lives in src/content/writing/ (the original) and its es/ and pt/ folders.
export const ui = {
  en: {
    skipLink: 'Skip to content',
    navLabel: 'Main',
    navWriting: 'Writing',
    navContact: 'Contact',
    downloadCv: 'Download CV',
    languageLabel: 'Language',
    contactTitle: 'Contact',
    contactLead: 'Email is the fastest way to reach me.',
    // The footer bio, one line each: "<role> at <company>.", "Based in <location>." and "Languages: <languages>."
    contactAt: 'at',
    contactBased: 'Based in',
    contactLanguages: 'Languages:',
    copyEmail: 'Copy email',
    copied: 'Copied',
    copyFailed: "Couldn't copy. Select the address instead.",
    source: 'Source:',
    writingTitle: 'Writing',
    writingIntro: 'Where I write about UX: the products I design and the games I study.',
    types: { playable: 'Playable game', analysis: 'Game UX analysis', academic: 'Academic project' },
    meta: { type: 'Type', context: 'Context', published: 'Published', readingTime: 'Reading time' },
    aboutGame: 'About the game',
    game: { name: 'Game', developer: 'Developer', released: 'Released', genre: 'Genre', platform: 'Platform' },
    notFound: {
      title: 'Page not found',
      heading: "This page doesn't exist",
      description: "This page doesn't exist.",
      dek: 'The address may be mistyped, or the page moved.',
      link: 'Read the Warcraft III analysis',
      rest: ' or use the contact details below.',
    },
  },
  es: {
    skipLink: 'Saltar al contenido',
    navLabel: 'Principal',
    navWriting: 'Artículos',
    navContact: 'Contacto',
    downloadCv: 'Descargar CV',
    languageLabel: 'Idioma',
    contactTitle: 'Contacto',
    contactLead: 'El email es la forma más rápida de contactarme.',
    contactAt: 'en',
    contactBased: 'Radicado en',
    contactLanguages: 'Idiomas:',
    copyEmail: 'Copiar email',
    copied: 'Copiado',
    copyFailed: 'No se pudo copiar. Seleccioná la dirección.',
    source: 'Fuente:',
    writingTitle: 'Artículos',
    writingIntro: 'Donde escribo sobre UX: los productos que diseño y los juegos que estudio.',
    types: { playable: 'Juego jugable', analysis: 'Análisis de UX de videojuegos', academic: 'Proyecto académico' },
    meta: { type: 'Tipo', context: 'Contexto', published: 'Publicado', readingTime: 'Tiempo de lectura' },
    aboutGame: 'Sobre el juego',
    game: { name: 'Juego', developer: 'Desarrolladora', released: 'Lanzamiento', genre: 'Género', platform: 'Plataforma' },
    notFound: {
      title: 'Página no encontrada',
      heading: 'Esta página no existe',
      description: 'Esta página no existe.',
      dek: 'Puede que la dirección tenga un error o que la página se haya movido.',
      link: 'Leé el análisis de Warcraft III',
      rest: ' o usá los datos de contacto de abajo.',
    },
  },
  pt: {
    skipLink: 'Pular para o conteúdo',
    navLabel: 'Principal',
    navWriting: 'Artigos',
    navContact: 'Contato',
    downloadCv: 'Baixar CV',
    languageLabel: 'Idioma',
    contactTitle: 'Contato',
    contactLead: 'O e-mail é o jeito mais rápido de falar comigo.',
    contactAt: 'na',
    contactBased: 'Baseado em',
    contactLanguages: 'Idiomas:',
    copyEmail: 'Copiar e-mail',
    copied: 'Copiado',
    copyFailed: 'Não foi possível copiar. Selecione o endereço.',
    source: 'Fonte:',
    writingTitle: 'Artigos',
    writingIntro: 'Onde escrevo sobre UX: os produtos que projeto e os jogos que estudo.',
    types: { playable: 'Jogo jogável', analysis: 'Análise de UX de games', academic: 'Projeto acadêmico' },
    meta: { type: 'Tipo', context: 'Contexto', published: 'Publicado', readingTime: 'Tempo de leitura' },
    aboutGame: 'Sobre o jogo',
    game: { name: 'Jogo', developer: 'Desenvolvedora', released: 'Lançamento', genre: 'Gênero', platform: 'Plataforma' },
    notFound: {
      title: 'Página não encontrada',
      heading: 'Esta página não existe',
      description: 'Esta página não existe.',
      dek: 'O endereço pode estar errado, ou a página mudou de lugar.',
      link: 'Leia a análise de Warcraft III',
      rest: ' ou use os dados de contato abaixo.',
    },
  },
};

/**
 * Interface copy for the page at this path.
 * @param {string} pathname
 */
export function t(pathname) {
  return ui[langFromPath(pathname)];
}
