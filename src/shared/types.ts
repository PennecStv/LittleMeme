// Types partagés entre le moteur (hôte), le réseau et l'interface.

/** Zone de texte d'un template, en coordonnées relatives (0..1). */
export type TextZone = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** "outline" = texte blanc contour noir (style meme), "plain" = texte noir. */
  style?: 'outline' | 'plain';
};

/** Élément décoratif des templates intégrés (pas besoin d'image). */
export type EmojiItem = { e: string; x: number; y: number; size: number };
export type Panel = { x: number; y: number; w: number; h: number; color: string };

export type MemeTemplate = {
  id: string;
  name: string;
  /** largeur / hauteur */
  aspect: number;
  zones: TextZone[];
  /** Image fournie par un pack perso : récupérée via le réseau avec son id. */
  hasImage: boolean;
  bg?: string;
  panels?: Panel[];
  emojis?: EmojiItem[];
};

export type MemePack = {
  id: string;
  name: string;
  builtin?: boolean;
  templates: MemeTemplate[];
};

export type GameSettings = {
  rounds: number;
  writeSeconds: number;
  revealSeconds: number;
  votingEnabled: boolean;
  voteSeconds: number;
  recapSeconds: number;
  rerolls: number;
  packIds: string[];
};

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 3,
  writeSeconds: 60,
  revealSeconds: 6,
  votingEnabled: false,
  voteSeconds: 20,
  recapSeconds: 10,
  rerolls: 1,
  packIds: [],
};

/** Bornes utilisées par l'UI et par l'hôte pour valider les paramètres. */
export const SETTINGS_LIMITS = {
  rounds: { min: 1, max: 15, step: 1 },
  writeSeconds: { min: 15, max: 300, step: 15 },
  revealSeconds: { min: 3, max: 20, step: 1 },
  voteSeconds: { min: 10, max: 90, step: 5 },
  recapSeconds: { min: 3, max: 60, step: 1 },
  rerolls: { min: 0, max: 5, step: 1 },
} as const;

export type Phase = 'lobby' | 'writing' | 'reveal' | 'voting' | 'roundResults' | 'final';

export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  score: number;
  /** Id de la photo de profil, à récupérer comme une image ("getAsset"). */
  avatarId: string | null;
  /** En phase d'écriture : a validé son meme. */
  ready: boolean;
};

export type Submission = {
  id: string;
  playerId: string;
  playerName: string;
  template: MemeTemplate;
  captions: string[];
  votes: number;
};

export type RoundRecord = { round: number; submissions: Submission[] };

export type MyAssignment = {
  template: MemeTemplate;
  captions: string[];
  ready: boolean;
  rerollsLeft: number;
};

/** Vue de la partie envoyée à un joueur (personnalisée : on ne voit pas les memes des autres pendant l'écriture). */
export type GameView = {
  phase: Phase;
  players: PublicPlayer[];
  settings: GameSettings;
  packs: { id: string; name: string; count: number }[];
  round: number;
  /** Temps restant dans la phase au moment de l'envoi (ms), null si pas de timer. */
  remainingMs: number | null;
  phaseDurationMs: number | null;
  me: MyAssignment | null;
  /** reveal / voting / roundResults : memes de la manche en cours. */
  submissions: Submission[];
  revealIndex: number;
  myVote: string | null;
  /** final : toutes les manches. */
  history: RoundRecord[];
};

export type ClientMessage =
  | { t: 'hello'; playerId: string; name: string; protocol: number; avatar?: string }
  | { t: 'settings'; settings: Partial<GameSettings> }
  | { t: 'start' }
  | { t: 'captions'; captions: string[] }
  | { t: 'ready'; ready: boolean }
  | { t: 'reroll' }
  | { t: 'vote'; submissionId: string }
  | { t: 'getAsset'; id: string }
  | { t: 'skip' }
  | { t: 'backToLobby' }
  | { t: 'kick'; playerId: string };

export type HostMessage =
  | { t: 'welcome'; playerId: string; isHost: boolean }
  | { t: 'view'; view: GameView }
  | { t: 'asset'; id: string; data: string | null }
  | { t: 'error'; message: string; fatal?: boolean };

export const PROTOCOL_VERSION = 1;
export const GAME_PORT = 47777;
