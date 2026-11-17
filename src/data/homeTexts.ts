import { useSyncExternalStore } from 'react';

// Textes de l'écran d'accueil. Une combinaison est tirée au lancement de l'app,
// puis une nouvelle après chaque partie (en quittant une partie).

export const TAGLINES = ['Des memes à faire en pause déj', 'On va rigoler pendant la pause déj'];

/** Phrases surprises façon Minecraft. Ajoute les tiennes ici ! */
export const SPLASHES = [
  'Zéro pub !',
  '100 % fait maison',
  'Approuvé par ton chef (non)',
  'Sans gluten !',
  'Le Wifi, c’est la vie',
  'Plus drôle que la réunion de 14h',
  'Aussi sur ton frigo !',
  'Pas de micro-ondes requis',
];

type HomeText = { tagline: string; splash: string };

const pick = <T,>(list: T[], avoid?: T): T => {
  if (list.length <= 1) return list[0];
  let value: T;
  do value = list[Math.floor(Math.random() * list.length)];
  while (value === avoid);
  return value;
};

let current: HomeText = { tagline: pick(TAGLINES), splash: pick(SPLASHES) };
let version = 0;
const listeners = new Set<() => void>();

export function rotateHomeText() {
  current = { tagline: pick(TAGLINES, current.tagline), splash: pick(SPLASHES, current.splash) };
  version += 1;
  listeners.forEach((cb) => cb());
}

export function useHomeText(): HomeText {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
  return current;
}
