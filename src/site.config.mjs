// Your personal data lives here, in one place.
// The build fails while any placeholder remains (see README).
// Texts shown to visitors have one version per language of the site: en, es and pt (src/i18n.mjs).

export const site = {
  name: 'Juan Manuel Gelay',
  role: {
    en: 'Product Design Manager at Auronix',
    es: 'Product Design Manager en Auronix',
    pt: 'Product Design Manager na Auronix',
  },
  location: {
    en: 'Buenos Aires, Argentina (UTC-3)',
    es: 'Buenos Aires, Argentina (UTC-3)',
    pt: 'Buenos Aires, Argentina (UTC-3)',
  },
  // Optional. Leave empty to hide. Example: 'Spanish (native), English (B2)'
  languages: {
    en: 'Spanish (native), English (B2+), Portuguese (B2)',
    es: 'español (nativo), inglés (B2+), portugués (B2)',
    pt: 'espanhol (nativo), inglês (B2+), português (B2)',
  },
  email: 'juanmanuelgelay@gmail.com',
  linkedin: 'https://www.linkedin.com/in/juanmagelay/',
  github: 'https://github.com/juanmagelay',
  // Put each PDF in public/cv/ with this exact file name.
  // The English URL is already shared: replace the file, never rename it.
  // The Spanish site links the Spanish CV; the English and Portuguese sites link the English one.
  cvPath: '/cv/Juan Manuel Gelay - UX & Product Design Manager (English).pdf',
  cvSpanishPath: '/cv/Juan Manuel Gelay - Product Design Manager (Spanish).pdf',
  // The file names visitors get when they download each CV.
  cvDownloadName: 'CV Juan Manuel Gelay · Product Design Manager.pdf',
  cvSpanishDownloadName: 'CV Juan Manuel Gelay · Product Design Manager (ES).pdf',
  // Optional. Umami Cloud website ID. Leave empty and no analytics script loads.
  umamiWebsiteId: 'f32a0c5f-6eb5-47bd-b237-bba30a666281',
};
