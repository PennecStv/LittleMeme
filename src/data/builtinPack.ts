import { MemePack, MemeTemplate, TextZone } from '../shared/types';

// Pack livré avec l'app : des templates dessinés avec des emojis (aucune image à télécharger).
// Pour de vraies photos, crée tes propres packs dans l'app.

const TOP: TextZone = { x: 0.03, y: 0.02, w: 0.94, h: 0.24 };
const BOTTOM: TextZone = { x: 0.03, y: 0.74, w: 0.94, h: 0.24 };

function single(id: string, name: string, e: string, bg: string): MemeTemplate {
  return { id, name, aspect: 1, hasImage: false, bg, emojis: [{ e, x: 0.5, y: 0.5, size: 0.42 }], zones: [TOP, BOTTOM] };
}

/** Format "Drake" : on refuse en haut, on adore en bas. */
function drake(id: string, name: string, no: string, yes: string): MemeTemplate {
  return {
    id,
    name,
    aspect: 1,
    hasImage: false,
    bg: '#ffffff',
    panels: [
      { x: 0, y: 0, w: 0.4, h: 0.5, color: '#ffeaa7' },
      { x: 0, y: 0.5, w: 0.4, h: 0.5, color: '#fab1a0' },
      { x: 0, y: 0.497, w: 1, h: 0.006, color: '#2d3436' },
    ],
    emojis: [
      { e: no, x: 0.2, y: 0.25, size: 0.24 },
      { e: yes, x: 0.2, y: 0.75, size: 0.24 },
    ],
    zones: [
      { x: 0.43, y: 0.03, w: 0.54, h: 0.44, style: 'plain' },
      { x: 0.43, y: 0.53, w: 0.54, h: 0.44, style: 'plain' },
    ],
  };
}

/** Deux colonnes à comparer. */
function versus(id: string, name: string, left: string, right: string, colors: [string, string]): MemeTemplate {
  return {
    id,
    name,
    aspect: 1,
    hasImage: false,
    bg: '#ffffff',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.7, color: colors[0] },
      { x: 0.5, y: 0, w: 0.5, h: 0.7, color: colors[1] },
    ],
    emojis: [
      { e: left, x: 0.25, y: 0.35, size: 0.28 },
      { e: right, x: 0.75, y: 0.35, size: 0.28 },
    ],
    zones: [
      { x: 0.02, y: 0.72, w: 0.46, h: 0.26, style: 'plain' },
      { x: 0.52, y: 0.72, w: 0.46, h: 0.26, style: 'plain' },
    ],
  };
}

/** Barre de texte blanche en haut, image en dessous (format "Quand tu..."). */
function captionTop(id: string, name: string, emojis: MemeTemplate['emojis'], bg: string): MemeTemplate {
  return {
    id,
    name,
    aspect: 0.85,
    hasImage: false,
    bg,
    panels: [{ x: 0, y: 0, w: 1, h: 0.3, color: '#ffffff' }],
    emojis,
    zones: [{ x: 0.04, y: 0.02, w: 0.92, h: 0.26, style: 'plain' }],
  };
}

/** Escalade en 4 étapes, du plus nul au plus génial. */
function escalation(id: string, name: string, steps: string[]): MemeTemplate {
  const colors = ['#dfe6e9', '#81ecec', '#a29bfe', '#fd79a8'];
  return {
    id,
    name,
    aspect: 0.75,
    hasImage: false,
    bg: '#ffffff',
    panels: steps.map((_, i) => ({ x: 0.6, y: i * 0.25, w: 0.4, h: 0.25, color: colors[i] })),
    emojis: steps.map((e, i) => ({ e, x: 0.8, y: i * 0.25 + 0.125, size: 0.12 + i * 0.025 })),
    zones: steps.map((_, i) => ({ x: 0.03, y: i * 0.25 + 0.01, w: 0.55, h: 0.23, style: 'plain' as const })),
  };
}

export const BUILTIN_PACK: MemePack = {
  id: 'builtin-emoji',
  name: 'Classiques (emojis)',
  builtin: true,
  templates: [
    single('e-blank', 'Le regard vide', '😐', '#6c5ce7'),
    single('e-panic', 'La panique', '😱', '#e17055'),
    single('e-clown', 'Le clown', '🤡', '#00b894'),
    single('e-frog', 'La grenouille', '🐸', '#0984e3'),
    single('e-cool', 'Trop stylé', '😎', '#e1a32a'),
    single('e-skull', 'Mort de rire', '💀', '#2d3436'),
    single('e-cat', 'Le chat qui juge', '😾', '#8e7cc3'),
    single('e-sad', 'Le sourire forcé', '🥲', '#3c8dde'),
    single('e-think', 'Réflexion intense', '🤔', '#00a8a8'),
    single('e-moai', 'Le moai', '🗿', '#636e72'),
    single('e-melt', 'Je fonds', '🫠', '#e84393'),
    {
      id: 'e-fine',
      name: 'Tout va bien',
      aspect: 1,
      hasImage: false,
      bg: '#e17055',
      emojis: [
        { e: '🔥', x: 0.18, y: 0.55, size: 0.2 },
        { e: '🐶', x: 0.5, y: 0.5, size: 0.34 },
        { e: '☕', x: 0.68, y: 0.6, size: 0.14 },
        { e: '🔥', x: 0.85, y: 0.45, size: 0.2 },
      ],
      zones: [TOP, BOTTOM],
    },
    drake('e-drake', 'Non / Oui', '🙅', '😍'),
    drake('e-drake2', 'Bof / Waouh', '😒', '🤩'),
    versus('e-angel', 'Ange vs Démon', '😇', '😈', ['#dff9fb', '#ff7675']),
    versus('e-expect', 'Attente vs Réalité', '✨', '💩', ['#ffeaa7', '#b2bec3']),
    versus('e-me', 'Moi vs Mon pote', '🧍', '🕺', ['#74b9ff', '#55efc4']),
    captionTop('e-run', 'Personne : / Moi :', [{ e: '🏃', x: 0.5, y: 0.65, size: 0.4 }], '#00b894'),
    captionTop(
      'e-boss',
      'Le boss final',
      [
        { e: '🧍', x: 0.22, y: 0.75, size: 0.18 },
        { e: '👹', x: 0.68, y: 0.6, size: 0.45 },
      ],
      '#2d3436',
    ),
    captionTop(
      'e-side',
      'Le regard en coin',
      [
        { e: '👀', x: 0.5, y: 0.62, size: 0.32 },
        { e: '💦', x: 0.75, y: 0.5, size: 0.12 },
      ],
      '#fdcb6e',
    ),
    escalation('e-brain', 'Cerveau galactique', ['🧠', '💡', '🌟', '🌌']),
    escalation('e-power', 'Montée en puissance', ['🐣', '🐥', '🐔', '🦖']),
  ],
};
