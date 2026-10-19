import { getCollection, type CollectionEntry } from 'astro:content';
import { DEFAULT_LANG } from '../i18n.mjs';

// The posts of one language. A translation takes its text from src/content/writing/<lang>/ and everything
// else from the original. A post without a translation is left out of that language; npm test names it.
export interface Post {
  slug: string;
  data: CollectionEntry<'writing'>['data'];
  entry: CollectionEntry<'writing'> | CollectionEntry<'writingTranslations'>;
}

export async function getPosts(lang: string): Promise<Post[]> {
  const originals = await getCollection('writing');
  if (lang === DEFAULT_LANG) return originals.map((entry) => ({ slug: entry.id, data: entry.data, entry }));

  const translations = await getCollection('writingTranslations', (entry) => entry.id.startsWith(`${lang}/`));
  return originals.flatMap((original) => {
    const translation = translations.find((entry) => entry.id === `${lang}/${original.id}`);
    if (!translation) return [];
    const { game, ...text } = translation.data;
    const data = { ...original.data, ...text, game: original.data.game && { ...original.data.game, ...game } };
    return [{ slug: original.id, data, entry: translation }];
  });
}
