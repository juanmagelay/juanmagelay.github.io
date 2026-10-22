// Your personal data lives here, in one place.
// The build fails while any placeholder remains (see README).
// Texts shown to visitors have one version per language of the site: en, es and pt (src/i18n.mjs).

export const site = {
  name: 'Juan Manuel Gelay',
  // The job title only. The footer adds the company, linked: "<role> at Auronix".
  role: {
    en: 'Product Design Manager',
    es: 'Product Design Manager',
    pt: 'Product Design Manager',
  },
  company: { name: 'Auronix', url: 'https://www.auronix.com/' },
  location: {
    en: 'Buenos Aires, Argentina (UTC-3)',
    es: 'Buenos Aires, Argentina (UTC-3)',
    pt: 'Buenos Aires, Argentina (UTC-3)',
  },
  // Optional. Leave empty to hide. Example: 'Spanish (native), English'
  languages: {
    en: 'Spanish (native), English, Portuguese',
    es: 'español (nativo), inglés, portugués',
    pt: 'espanhol (nativo), inglês, português',
  },
  // My photo, the same as on LinkedIn, is src/assets/profile-photo.jpg. The footer shows it next to the bio.
  photoAlt: {
    en: 'Juan Manuel Gelay smiling, in a black T-shirt, against a blue background.',
    es: 'Juan Manuel Gelay sonriendo, con remera negra, sobre un fondo azul.',
    pt: 'Juan Manuel Gelay sorrindo, de camiseta preta, sobre um fundo azul.',
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
