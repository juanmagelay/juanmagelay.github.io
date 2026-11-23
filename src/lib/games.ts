import { getCollection, type CollectionEntry } from 'astro:content';
import { DEFAULT_LANG } from '../i18n.mjs';

// The games of one language, newest first. A translation takes its text from src/content/games/<lang>/ and
// everything else from the original. A game without a translation is left out of that language; npm test names it.
// Issue #17.
export interface Game {
  slug: string;
  data: CollectionEntry<'games'>['data'];
  entry: CollectionEntry<'games'> | CollectionEntry<'gamesTranslations'>;
}

export async function getGames(lang: string): Promise<Game[]> {
  const originals = await getCollection('games');
  const games =
    lang === DEFAULT_LANG
      ? originals.map((entry) => ({ slug: entry.id, data: entry.data, entry }))
      : await translated(originals, lang);
  // Games from the same year go by title, so the order is the same on every build.
  return games.sort((a, b) => b.data.year - a.data.year || a.data.title.localeCompare(b.data.title, lang));
}

async function translated(originals: CollectionEntry<'games'>[], lang: string): Promise<Game[]> {
  const translations = await getCollection('gamesTranslations', (entry) => entry.id.startsWith(`${lang}/`));
  return originals.flatMap((original) => {
    const translation = translations.find((entry) => entry.id === `${lang}/${original.id}`);
    if (!translation) return [];
    const text = Object.fromEntries(Object.entries(translation.data).filter(([, value]) => value !== undefined));
    return [{ slug: original.id, data: { ...original.data, ...text }, entry: translation }];
  });
}
