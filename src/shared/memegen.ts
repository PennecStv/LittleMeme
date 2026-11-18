import { TextZone } from './types';

// Templates de memes de memegen.link (open source, sans clé).
// Les positions des textes ne sont pas dans l'API : elles sont dans le config.yml de chaque template sur GitHub.

export const MEMEGEN_TEMPLATES_URL = 'https://api.memegen.link/templates/';
export const memegenConfigUrl = (id: string) =>
  `https://raw.githubusercontent.com/jacebrowning/memegen/main/templates/${encodeURIComponent(id)}/config.yml`;

export type MemegenTemplate = { id: string; name: string; lines: number; blank: string };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Lit les zones de texte de la section `text:` d'un config.yml memegen.
 * Valeurs par défaut de memegen : anchor 0/0, scale 1 × 0.2.
 * shortcut: lecture ligne à ligne ciblée sur ce format, pas un vrai parseur YAML ; à remplacer si memegen change de format.
 */
export function parseMemegenZones(yml: string, lines: number): TextZone[] {
  const zones: TextZone[] = [];
  let inText = false;
  let cur: Record<string, string> | null = null;
  const flush = () => {
    if (!cur) return;
    const x = clamp01(Number(cur.anchor_x ?? 0) || 0);
    const y = clamp01(Number(cur.anchor_y ?? 0) || 0);
    const w = Math.min(1 - x, clamp01(Number(cur.scale_x ?? 1) || 1));
    const h = Math.min(1 - y, clamp01(Number(cur.scale_y ?? 0.2) || 0.2));
    if (w > 0.05 && h > 0.03) zones.push({ x, y, w, h, style: cur.color === 'black' ? 'plain' : 'outline' });
    cur = null;
  };
  for (const raw of yml.split(/\r?\n/)) {
    if (/^\S/.test(raw)) {
      flush();
      inText = raw.startsWith('text:');
      continue;
    }
    if (!inText) continue;
    const m = raw.match(/^\s*(-\s*)?(\w+):\s*(.*?)\s*$/);
    if (!m) continue;
    if (m[1]) {
      flush();
      cur = {};
    }
    if (cur) cur[m[2]] = m[3];
  }
  flush();
  if (zones.length) return zones.slice(0, Math.max(lines, 1));
  // Pas de config lisible : textes répartis du haut vers le bas.
  const n = Math.max(1, lines);
  return Array.from({ length: n }, (_, i) => ({ x: 0, y: n === 1 ? 0 : (i / (n - 1)) * 0.8, w: 1, h: 0.2 }));
}
