import { useSyncExternalStore } from 'react';

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  /** Deuxième couleur forte (logo, stickers). */
  accent2: string;
  success: string;
  danger: string;
};

export const THEMES = {
  classic: {
    name: 'Le Classique',
    description: 'Gris, jaune et bleu',
    palette: {
      bg: '#1e2228',
      surface: '#2a2f37',
      surfaceAlt: '#353b45',
      border: '#434a56',
      text: '#ffffff',
      muted: '#a2aab6',
      accent: '#ffc933',
      accentText: '#1e2228',
      accent2: '#3d8bff',
      success: '#3ddc97',
      danger: '#ff5c5c',
    },
  },
  x: {
    name: 'Le X',
    description: 'Noir, rouge et blanc',
    palette: {
      bg: '#0d0d0d',
      surface: '#1c1c1c',
      surfaceAlt: '#313131',
      border: '#3d3d3d',
      text: '#ffffff',
      muted: '#a3a3a3',
      accent: '#e10600',
      accentText: '#ffffff',
      accent2: '#ffffff',
      success: '#3ddc97',
      danger: '#ff7a7a',
    },
  },
  og: {
    name: 'Le OG',
    description: 'Vert foncé, vert clair et blanc',
    palette: {
      bg: '#0b2416',
      surface: '#12341f',
      surfaceAlt: '#1a442a',
      border: '#285a3a',
      text: '#ffffff',
      muted: '#9cc4ab',
      accent: '#7ee06a',
      accentText: '#0b2416',
      accent2: '#ffffff',
      success: '#7ee06a',
      danger: '#ff7a7a',
    },
  },
} satisfies Record<string, { name: string; description: string; palette: Palette }>;

export type ThemeId = keyof typeof THEMES;

/** Palette courante : l'objet est mis à jour sur place quand on change de thème. */
export const colors: Palette = { ...THEMES.classic.palette };

let themeId: ThemeId = 'classic';
let version = 0;
const listeners = new Set<() => void>();

export function setTheme(id: string | undefined) {
  const next = (id && id in THEMES ? id : 'classic') as ThemeId;
  if (next === themeId && version > 0) return;
  themeId = next;
  Object.assign(colors, THEMES[next].palette);
  version += 1;
  listeners.forEach((cb) => cb());
}

export function useThemeId(): ThemeId {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => themeId,
  );
}

/** Feuille de styles recalculée automatiquement quand le thème change. */
export function themed<T extends object>(factory: () => T): T {
  let cache: T | null = null;
  let cacheVersion = -1;
  const current = () => {
    if (!cache || cacheVersion !== version) {
      cache = factory();
      cacheVersion = version;
    }
    return cache;
  };
  return new Proxy({} as T, { get: (_, key) => (current() as any)[key] });
}

export const fonts = {
  /** Interface : Montserrat (gros titres en Black). */
  display: 'Montserrat_900Black',
  heavy: 'Montserrat_800ExtraBold',
  bold: 'Montserrat_700Bold',
  semibold: 'Montserrat_600SemiBold',
  body: 'Montserrat_500Medium',
  /** Texte des memes, façon Impact. */
  meme: 'Anton_400Regular',
};

export const radius = { sm: 8, md: 12, lg: 16 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
