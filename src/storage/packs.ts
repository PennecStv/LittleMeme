import { File, Paths } from 'expo-file-system';
import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';
import { Image } from 'react-native';
import { BUILTIN_PACK } from '../data/builtinPack';
import { MEMEGEN_TEMPLATES_URL, memegenConfigUrl, MemegenTemplate, parseMemegenZones } from '../shared/memegen';
import { MemePack, MemeTemplate, TextZone } from '../shared/types';
import { createSignal, ensureDir, randomId, readJson, writeJson } from './files';

// Les packs perso sont stockés dans  <documents>/packs/index.json
// et leurs images dans               <documents>/packs/<templateId>.jpg

export const packsSignal = createSignal();

const MAX_IMAGE_SIZE = 1080;
// Les GIF passent en entier sur le Wifi à chaque joueur : on limite leur poids.
const MAX_GIF_BYTES = 8_000_000;

const packsDir = () => ensureDir('packs');
const indexFile = () => new File(packsDir(), 'index.json');
export const imageFile = (templateId: string, gif?: boolean) => new File(packsDir(), `${templateId}.${gif ? 'gif' : 'jpg'}`);

let cache: MemePack[] | null = null;

export function getUserPacks(): MemePack[] {
  if (!cache) cache = readJson<MemePack[]>(indexFile(), []);
  return cache;
}

export function getAllPacks(): MemePack[] {
  return [BUILTIN_PACK, ...getUserPacks()];
}

export function getPack(id: string): MemePack | undefined {
  return getAllPacks().find((p) => p.id === id);
}

function save(packs: MemePack[]) {
  cache = packs;
  writeJson(indexFile(), packs);
  packsSignal.emit();
}

export function createPack(name: string): MemePack {
  const pack: MemePack = { id: randomId('pack'), name: name.trim() || 'Mon pack', templates: [] };
  save([...getUserPacks(), pack]);
  return pack;
}

export function renamePack(id: string, name: string) {
  save(getUserPacks().map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)));
}

export function deletePack(id: string) {
  const pack = getUserPacks().find((p) => p.id === id);
  pack?.templates.forEach((t) => deleteImage(t.id));
  save(getUserPacks().filter((p) => p.id !== id));
}

export const ZONE_PRESETS: { key: string; label: string; zones: TextZone[] }[] = [
  {
    key: 'topBottom',
    label: 'Haut + bas',
    zones: [
      { x: 0.03, y: 0.02, w: 0.94, h: 0.22 },
      { x: 0.03, y: 0.76, w: 0.94, h: 0.22 },
    ],
  },
  { key: 'top', label: 'Haut', zones: [{ x: 0.03, y: 0.02, w: 0.94, h: 0.25 }] },
  { key: 'bottom', label: 'Bas', zones: [{ x: 0.03, y: 0.73, w: 0.94, h: 0.25 }] },
  { key: 'center', label: 'Centre', zones: [{ x: 0.05, y: 0.35, w: 0.9, h: 0.3 }] },
  {
    key: 'leftRight',
    label: 'Gauche + droite',
    zones: [
      { x: 0.02, y: 0.6, w: 0.46, h: 0.36 },
      { x: 0.52, y: 0.6, w: 0.46, h: 0.36 },
    ],
  },
];

/** Redimensionne et copie l'image choisie dans le stockage de l'app, puis l'ajoute au pack. */
export async function addTemplate(
  packId: string,
  source: { uri: string; width: number; height: number; mimeType?: string },
  name: string,
  zones: TextZone[],
): Promise<MemeTemplate> {
  const isGif = source.mimeType === 'image/gif' || /\.gif$/i.test(source.uri);
  if (isGif) {
    // Un GIF garde son animation : pas de redimensionnement, il est copié tel quel.
    const file = new File(source.uri);
    if ((file.size ?? 0) > MAX_GIF_BYTES) throw new Error(`GIF trop lourd (max ${MAX_GIF_BYTES / 1_000_000} Mo)`);
    const template: MemeTemplate = {
      id: randomId('t'),
      name: name.trim() || 'Sans titre',
      aspect: source.width / source.height,
      hasImage: true,
      gif: true,
      zones,
    };
    file.copySync(imageFile(template.id, true));
    save(getUserPacks().map((p) => (p.id === packId ? { ...p, templates: [...p.templates, template] } : p)));
    return template;
  }
  const ctx = ImageManipulator.manipulate(source.uri);
  const longest = Math.max(source.width, source.height);
  if (longest > MAX_IMAGE_SIZE) {
    ctx.resize(source.width >= source.height ? { width: MAX_IMAGE_SIZE } : { height: MAX_IMAGE_SIZE });
  }
  const ref = await ctx.renderAsync();
  const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.72 });

  const template: MemeTemplate = {
    id: randomId('t'),
    name: name.trim() || 'Sans titre',
    aspect: result.width / result.height,
    hasImage: true,
    zones,
  };
  new File(result.uri).copySync(imageFile(template.id));

  save(getUserPacks().map((p) => (p.id === packId ? { ...p, templates: [...p.templates, template] } : p)));
  return template;
}

export function updateTemplate(packId: string, templateId: string, patch: Partial<Pick<MemeTemplate, 'name' | 'zones'>>) {
  save(
    getUserPacks().map((p) =>
      p.id === packId ? { ...p, templates: p.templates.map((t) => (t.id === templateId ? { ...t, ...patch } : t)) } : p,
    ),
  );
}

export function deleteTemplate(packId: string, templateId: string) {
  deleteImage(templateId);
  save(getUserPacks().map((p) => (p.id === packId ? { ...p, templates: p.templates.filter((t) => t.id !== templateId) } : p)));
}

function deleteImage(templateId: string) {
  try {
    for (const f of [imageFile(templateId), imageFile(templateId, true)]) if (f.exists) f.delete();
  } catch {
    // tant pis
  }
}

/** Utilisé par l'hôte pour envoyer une image aux autres joueurs. */
export async function readTemplateImage(templateId: string): Promise<string | null> {
  const gif = imageFile(templateId, true);
  const f = gif.exists ? gif : imageFile(templateId);
  if (!f.exists) return null;
  return `data:image/${gif.exists ? 'gif' : 'jpeg'};base64,${await f.base64()}`;
}

export const MEMEGEN_PACK_NAME = 'Memes populaires';

/**
 * Télécharge les templates de memegen.link dans un pack local (Internet requis une seule fois).
 * Relancer l'import reprend là où il s'est arrêté : les memes déjà présents sont sautés.
 */
export async function importMemegenPack(onProgress: (done: number, total: number) => void) {
  const res = await fetch(MEMEGEN_TEMPLATES_URL);
  if (!res.ok) throw new Error(`memegen.link indisponible (HTTP ${res.status})`);
  const list: MemegenTemplate[] = await res.json();
  const pack = getUserPacks().find((p) => p.name === MEMEGEN_PACK_NAME) ?? createPack(MEMEGEN_PACK_NAME);
  const existing = new Set(pack.templates.map((t) => t.name));
  let added = 0;
  let failed = 0;
  // Un par un : addTemplate réécrit l'index des packs, des appels en parallèle s'écraseraient.
  for (const [i, t] of list.entries()) {
    onProgress(i, list.length);
    if (existing.has(t.name)) continue;
    try {
      const tmp = new File(Paths.cache, `memegen-${i}.jpg`);
      const [yml, file] = await Promise.all([
        fetch(memegenConfigUrl(t.id)).then((r) => (r.ok ? r.text() : '')),
        File.downloadFileAsync(t.blank, tmp, { idempotent: true }),
      ]);
      const { width, height } = await Image.getSize(file.uri);
      await addTemplate(pack.id, { uri: file.uri, width, height }, t.name, parseMemegenZones(yml, t.lines));
      file.delete();
      added++;
    } catch {
      failed++;
    }
  }
  onProgress(list.length, list.length);
  return { added, failed };
}
