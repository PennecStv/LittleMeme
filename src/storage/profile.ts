import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useSyncExternalStore } from 'react';
import { GameSettings } from '../shared/types';
import { createSignal, randomId, readJson, writeJson } from './files';

export type Profile = {
  playerId: string;
  name: string;
  lastSettings?: Partial<GameSettings>;
  themeId?: string;
  /** Nom du fichier de la photo de profil dans les documents de l'app. */
  avatarFile?: string;
};

const AVATAR_SIZE = 192;

const file = () => new File(Paths.document, 'profile.json');
let cache: Profile | null = null;
export const profileSignal = createSignal();

export function getProfile(): Profile {
  if (!cache) {
    cache = readJson<Profile>(file(), { playerId: randomId('u'), name: '' });
    if (!cache.playerId) cache.playerId = randomId('u');
    writeJson(file(), cache);
  }
  return cache;
}

export function updateProfile(patch: Partial<Profile>) {
  cache = { ...getProfile(), ...patch };
  writeJson(file(), cache);
  profileSignal.emit();
}

export function useProfile(): Profile {
  useSyncExternalStore(profileSignal.subscribe, profileSignal.getVersion);
  return getProfile();
}

export function avatarUri(profile: Profile): string | null {
  if (!profile.avatarFile) return null;
  const f = new File(Paths.document, profile.avatarFile);
  return f.exists ? f.uri : null;
}

/** Recadre en petit carré et enregistre la nouvelle photo (nouveau nom de fichier = pas de cache d'image périmé). */
export async function setAvatar(sourceUri: string) {
  const ctx = ImageManipulator.manipulate(sourceUri);
  ctx.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  const ref = await ctx.renderAsync();
  const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  const name = `avatar-${Date.now().toString(36)}.jpg`;
  new File(result.uri).copySync(new File(Paths.document, name));
  removeAvatarFile();
  updateProfile({ avatarFile: name });
}

export function clearAvatar() {
  removeAvatarFile();
  updateProfile({ avatarFile: undefined });
}

function removeAvatarFile() {
  const old = getProfile().avatarFile;
  if (!old) return;
  try {
    const f = new File(Paths.document, old);
    if (f.exists) f.delete();
  } catch {
    // tant pis
  }
}

/** Photo de profil en data URI, envoyée à l'hôte en rejoignant une partie. */
export async function readAvatarData(): Promise<string | undefined> {
  const uri = avatarUri(getProfile());
  if (!uri) return undefined;
  try {
    return `data:image/jpeg;base64,${await new File(uri).base64()}`;
  } catch {
    return undefined;
  }
}
