import { getCollection, type CollectionEntry } from 'astro:content';
import { DEFAULT_LANG } from '../i18n.mjs';

// The case studies of one language, newest first. A translation takes its text from src/content/case-studies/<lang>/
// and everything else from the original. A case without a translation is left out of that language; npm test names
// it. Issue #21.
export interface CaseStudy {
  slug: string;
  data: CollectionEntry<'caseStudies'>['data'];
  entry: CollectionEntry<'caseStudies'> | CollectionEntry<'caseStudiesTranslations'>;
}

export async function getCaseStudies(lang: string): Promise<CaseStudy[]> {
  const originals = await getCollection('caseStudies');
  const cases =
    lang === DEFAULT_LANG
      ? originals.map((entry) => ({ slug: entry.id, data: entry.data, entry }))
      : await translated(originals, lang);
  // Cases from the same day go by title, so the order is the same on every build.
  return cases.sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime() || a.data.title.localeCompare(b.data.title, lang)
  );
}

async function translated(originals: CollectionEntry<'caseStudies'>[], lang: string): Promise<CaseStudy[]> {
  const translations = await getCollection('caseStudiesTranslations', (entry) => entry.id.startsWith(`${lang}/`));
  return originals.flatMap((original) => {
    const translation = translations.find((entry) => entry.id === `${lang}/${original.id}`);
    if (!translation) return [];
    const { game, ...rest } = translation.data;
    const text = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
    // The game's facts merge field by field: a translation only brings its genre and the image's alt text.
    const data = { ...original.data, ...text, game: original.data.game && { ...original.data.game, ...game } };
    return [{ slug: original.id, data, entry: translation }];
  });
}
