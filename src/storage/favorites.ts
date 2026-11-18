import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { createSignal, ensureDir, randomId, readJson, writeJson } from './files';

export type Favorite = {
  id: string;
  author: string;
  templateName: string;
  createdAt: number;
};

export const favoritesSignal = createSignal();

const dir = () => ensureDir('favorites');
const indexFile = () => new File(dir(), 'index.json');
export const favoriteFile = (id: string) => new File(dir(), `${id}.png`);

let cache: Favorite[] | null = null;

export function getFavorites(): Favorite[] {
  if (!cache) cache = readJson<Favorite[]>(indexFile(), []);
  return cache;
}

function save(list: Favorite[]) {
  cache = list;
  writeJson(indexFile(), list);
  favoritesSignal.emit();
}

/** Garde une copie du meme capturé dans l'app. */
export function addFavorite(capturedUri: string, meta: Omit<Favorite, 'id' | 'createdAt'>): Favorite {
  const fav: Favorite = { ...meta, id: randomId('f'), createdAt: Date.now() };
  new File(capturedUri).copySync(favoriteFile(fav.id));
  save([fav, ...getFavorites()]);
  return fav;
}

export function deleteFavorite(id: string) {
  try {
    const f = favoriteFile(id);
    if (f.exists) f.delete();
  } catch {
    // tant pis
  }
  save(getFavorites().filter((f) => f.id !== id));
}

/** Enregistre une image dans la galerie photo du téléphone. */
export async function saveToGallery(uri: string): Promise<boolean> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) return false;
  await MediaLibrary.Asset.create(uri);
  return true;
}
