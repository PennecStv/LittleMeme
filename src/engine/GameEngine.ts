import {
  ClientMessage,
  DEFAULT_SETTINGS,
  GameSettings,
  GameView,
  HostMessage,
  MemePack,
  MemeTemplate,
  Phase,
  PROTOCOL_VERSION,
  RoundRecord,
  SETTINGS_LIMITS,
  Submission,
} from '../shared/types';

// Moteur de jeu côté hôte. Il ne connaît rien du réseau : on lui branche des
// "connexions" (TCP pour les autres téléphones, locale pour le téléphone hôte).

export interface Connection {
  id: string;
  /** La connexion locale est celle du téléphone qui héberge : elle a les droits d'hôte. */
  isLocal: boolean;
  send(msg: HostMessage): void;
  close(): void;
}

export type EngineOptions = {
  packs: MemePack[];
  /** Renvoie l'image d'un template sous forme de data URI, ou null. */
  getAsset: (templateId: string) => Promise<string | null>;
  initialSettings?: Partial<GameSettings>;
  onSettingsChange?: (settings: GameSettings) => void;
  random?: () => number;
  now?: () => number;
};

type Player = {
  id: string;
  name: string;
  connId: string | null;
  isHost: boolean;
  score: number;
  avatarId: string | null;
};

type Assignment = {
  template: MemeTemplate;
  captions: string[];
  ready: boolean;
  rerollsLeft: number;
};

const MAX_CAPTION_LENGTH = 140;
const MAX_NAME_LENGTH = 20;
const MAX_AVATAR_LENGTH = 120_000;

export class GameEngine {
  private connections = new Map<string, Connection>();
  private connToPlayer = new Map<string, string>();
  private players = new Map<string, Player>();

  private phase: Phase = 'lobby';
  private settings: GameSettings;
  private round = 0;
  private deck: MemeTemplate[] = [];
  private assignments = new Map<string, Assignment>();
  private submissions: Submission[] = [];
  private revealIndex = 0;
  private votes = new Map<string, string>();
  private history: RoundRecord[] = [];

  private timer: ReturnType<typeof setTimeout> | null = null;
  private phaseEndsAt: number | null = null;
  private phaseDurationMs: number | null = null;
  private assetCache = new Map<string, string | null>();
  private idCounter = 0;

  private random: () => number;
  private now: () => number;

  constructor(private opts: EngineOptions) {
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? Date.now;
    const allPackIds = opts.packs.map((p) => p.id);
    const merged = { ...DEFAULT_SETTINGS, ...opts.initialSettings };
    const packIds = merged.packIds.filter((id) => allPackIds.includes(id));
    this.settings = { ...merged, packIds: packIds.length ? packIds : allPackIds };
  }

  // ---------------------------------------------------------------- connexions

  connect(conn: Connection) {
    this.connections.set(conn.id, conn);
  }

  disconnect(connId: string) {
    this.connections.delete(connId);
    const playerId = this.connToPlayer.get(connId);
    this.connToPlayer.delete(connId);
    if (!playerId) return;
    const player = this.players.get(playerId);
    if (!player || player.connId !== connId) return;
    if (this.phase === 'lobby') {
      this.players.delete(playerId);
    } else {
      // On garde le joueur pour qu'il puisse se reconnecter avec le même id.
      player.connId = null;
    }
    this.broadcast();
    if (this.phase === 'writing') this.checkAllReady();
    if (this.phase === 'voting') this.checkAllVoted();
  }

  receive(connId: string, msg: ClientMessage) {
    const conn = this.connections.get(connId);
    if (!conn || !msg || typeof msg !== 'object') return;

    if (msg.t === 'hello') return this.handleHello(conn, msg);
    if (msg.t === 'getAsset') return void this.sendAsset(conn, msg.id);

    const playerId = this.connToPlayer.get(connId);
    const player = playerId ? this.players.get(playerId) : undefined;
    if (!player) return;

    switch (msg.t) {
      case 'captions':
        return this.handleCaptions(player, msg.captions);
      case 'ready':
        return this.handleReady(player, msg.ready);
      case 'reroll':
        return this.handleReroll(player);
      case 'vote':
        return this.handleVote(player, msg.submissionId);
    }

    if (!player.isHost) return;
    switch (msg.t) {
      case 'settings':
        return this.handleSettings(msg.settings);
      case 'start':
        return this.startGame(conn);
      case 'skip':
        return this.skipPhase();
      case 'backToLobby':
        return this.backToLobby();
      case 'kick':
        return this.kick(msg.playerId);
    }
  }

  dispose() {
    this.clearTimer();
    for (const conn of this.connections.values()) conn.close();
    this.connections.clear();
  }

  // ---------------------------------------------------------------- messages

  private handleHello(conn: Connection, msg: Extract<ClientMessage, { t: 'hello' }>) {
    if (msg.protocol !== PROTOCOL_VERSION) {
      conn.send({ t: 'error', message: "Version de l'app différente de celle de l'hôte. Mettez à jour l'app.", fatal: true });
      return;
    }
    const id = String(msg.playerId || '').slice(0, 64) || this.newId('p');
    let player = this.players.get(id);
    if (player) {
      // Reconnexion : on rattache la nouvelle connexion au joueur existant.
      if (player.connId && player.connId !== conn.id) {
        this.connections.get(player.connId)?.close();
        this.connToPlayer.delete(player.connId);
      }
      player.connId = conn.id;
    } else {
      player = {
        id,
        name: this.uniqueName(msg.name),
        connId: conn.id,
        isHost: conn.isLocal,
        score: 0,
        avatarId: null,
      };
      this.players.set(id, player);
      if (this.phase === 'writing') this.assign(player);
    }
    this.setAvatar(player, msg.avatar);
    this.connToPlayer.set(conn.id, id);
    conn.send({ t: 'welcome', playerId: id, isHost: player.isHost });
    this.broadcast();
  }

  private setAvatar(player: Player, avatar: unknown) {
    if (typeof avatar !== 'string' || !avatar.startsWith('data:image/') || avatar.length > MAX_AVATAR_LENGTH) {
      player.avatarId = null;
      return;
    }
    // Nouvel id à chaque connexion : les clients ne gardent pas une ancienne photo en cache.
    player.avatarId = this.newId(`av-${player.id}-`);
    this.assetCache.set(player.avatarId, avatar);
  }

  private handleSettings(patch: Partial<GameSettings>) {
    if (this.phase !== 'lobby' || !patch) return;
    const s = { ...this.settings };
    const clamp = (key: keyof typeof SETTINGS_LIMITS) => {
      const v = patch[key];
      if (typeof v !== 'number' || !Number.isFinite(v)) return;
      const { min, max } = SETTINGS_LIMITS[key];
      s[key] = Math.round(Math.min(max, Math.max(min, v)));
    };
    (Object.keys(SETTINGS_LIMITS) as (keyof typeof SETTINGS_LIMITS)[]).forEach(clamp);
    if (typeof patch.votingEnabled === 'boolean') s.votingEnabled = patch.votingEnabled;
    if (Array.isArray(patch.packIds)) {
      const known = new Set(this.opts.packs.map((p) => p.id));
      s.packIds = patch.packIds.filter((id) => known.has(id));
    }
    this.settings = s;
    this.opts.onSettingsChange?.(s);
    this.broadcast();
  }

  private handleCaptions(player: Player, captions: unknown) {
    const a = this.assignments.get(player.id);
    if (this.phase !== 'writing' || !a || !Array.isArray(captions)) return;
    a.captions = a.template.zones.map((_, i) => String(captions[i] ?? '').slice(0, MAX_CAPTION_LENGTH));
    // Pas de broadcast : le joueur a déjà son texte, les autres ne doivent pas le voir.
  }

  private handleReady(player: Player, ready: boolean) {
    const a = this.assignments.get(player.id);
    if (this.phase !== 'writing' || !a) return;
    a.ready = !!ready;
    this.broadcast();
    this.checkAllReady();
  }

  private handleReroll(player: Player) {
    const a = this.assignments.get(player.id);
    if (this.phase !== 'writing' || !a || a.ready || a.rerollsLeft <= 0) return;
    const template = this.drawTemplate(new Set([a.template.id, ...this.usedThisRound()]));
    if (!template) return;
    a.template = template;
    a.captions = template.zones.map(() => '');
    a.rerollsLeft -= 1;
    this.sendView(player);
  }

  private handleVote(player: Player, submissionId: string) {
    if (this.phase !== 'voting') return;
    const sub = this.submissions.find((s) => s.id === submissionId);
    if (!sub || sub.playerId === player.id) return;
    this.votes.set(player.id, submissionId);
    this.sendView(player);
    this.checkAllVoted();
  }

  private async sendAsset(conn: Connection, id: string) {
    let data = this.assetCache.get(id);
    if (data === undefined) {
      try {
        data = await this.opts.getAsset(id);
      } catch {
        data = null;
      }
      this.assetCache.set(id, data);
    }
    conn.send({ t: 'asset', id, data });
  }

  private kick(playerId: string) {
    const player = this.players.get(playerId);
    if (!player || player.isHost) return;
    if (player.connId) {
      const conn = this.connections.get(player.connId);
      conn?.send({ t: 'error', message: "L'hôte t'a retiré de la partie.", fatal: true });
      conn?.close();
      this.connections.delete(player.connId);
      this.connToPlayer.delete(player.connId);
    }
    this.players.delete(playerId);
    this.assignments.delete(playerId);
    this.broadcast();
    if (this.phase === 'writing') this.checkAllReady();
  }

  // ---------------------------------------------------------------- déroulé

  private startGame(conn: Connection) {
    if (this.phase !== 'lobby') return;
    const templates = this.availableTemplates();
    if (templates.length === 0) {
      conn.send({ t: 'error', message: 'Aucun meme disponible : active au moins un pack non vide.' });
      return;
    }
    for (const p of this.players.values()) p.score = 0;
    this.history = [];
    this.round = 0;
    this.deck = [];
    this.startRound();
  }

  private startRound() {
    this.round += 1;
    this.assignments.clear();
    this.submissions = [];
    this.votes.clear();
    this.revealIndex = 0;
    for (const p of this.players.values()) {
      if (p.connId) this.assign(p);
    }
    this.setPhase('writing', this.settings.writeSeconds * 1000, () => this.endWriting());
  }

  private assign(player: Player) {
    const template = this.drawTemplate(new Set(this.usedThisRound()));
    if (!template) return;
    this.assignments.set(player.id, {
      template,
      captions: template.zones.map(() => ''),
      ready: false,
      rerollsLeft: this.settings.rerolls,
    });
  }

  private checkAllReady() {
    if (this.phase !== 'writing') return;
    const active = [...this.assignments.entries()].filter(([pid]) => this.players.get(pid)?.connId);
    if (active.length > 0 && active.every(([, a]) => a.ready)) this.endWriting();
  }

  private endWriting() {
    const subs: Submission[] = [];
    for (const [pid, a] of this.assignments) {
      const player = this.players.get(pid);
      if (!player || a.captions.every((c) => c.trim() === '')) continue;
      subs.push({
        id: this.newId('s'),
        playerId: pid,
        playerName: player.name,
        template: a.template,
        captions: a.captions.map((c) => c.trim()),
        votes: 0,
      });
    }
    this.submissions = this.shuffle(subs);
    if (this.submissions.length === 0) return this.enterRoundResults();
    this.revealIndex = 0;
    this.setPhase('reveal', this.settings.revealSeconds * 1000, () => this.nextReveal());
  }

  private nextReveal() {
    if (this.revealIndex < this.submissions.length - 1) {
      this.revealIndex += 1;
      this.setPhase('reveal', this.settings.revealSeconds * 1000, () => this.nextReveal());
      return;
    }
    if (this.settings.votingEnabled && this.submissions.length >= 2) {
      this.votes.clear();
      this.setPhase('voting', this.settings.voteSeconds * 1000, () => this.endVoting());
    } else {
      this.enterRoundResults();
    }
  }

  private eligibleVoters(): Player[] {
    // Peut voter : tout joueur connecté qui a au moins un meme d'un autre joueur pour qui voter.
    return [...this.players.values()].filter(
      (p) => p.connId && this.submissions.some((s) => s.playerId !== p.id),
    );
  }

  private checkAllVoted() {
    if (this.phase !== 'voting') return;
    const voters = this.eligibleVoters();
    if (voters.length > 0 && voters.every((p) => this.votes.has(p.id))) this.endVoting();
  }

  private endVoting() {
    for (const subId of this.votes.values()) {
      const sub = this.submissions.find((s) => s.id === subId);
      if (sub) sub.votes += 1;
    }
    for (const sub of this.submissions) {
      const author = this.players.get(sub.playerId);
      if (author) author.score += sub.votes;
    }
    this.enterRoundResults();
  }

  private enterRoundResults() {
    this.history.push({
      round: this.round,
      submissions: this.submissions.map((s) => ({ ...s, captions: [...s.captions] })),
    });
    const isLast = this.round >= this.settings.rounds;
    this.setPhase('roundResults', this.settings.recapSeconds * 1000, () => {
      if (isLast) this.setPhase('final', null, null);
      else this.startRound();
    });
  }

  private skipPhase() {
    const handler = this.pendingHandler;
    if (!handler) return;
    this.clearTimer();
    handler();
  }

  private backToLobby() {
    this.clearTimer();
    this.assignments.clear();
    this.submissions = [];
    this.votes.clear();
    this.round = 0;
    // Les joueurs déconnectés pendant la partie sont retirés.
    for (const [id, p] of this.players) if (!p.connId) this.players.delete(id);
    this.setPhase('lobby', null, null);
  }

  // ---------------------------------------------------------------- timers

  private pendingHandler: (() => void) | null = null;

  private setPhase(phase: Phase, durationMs: number | null, onEnd: (() => void) | null) {
    this.clearTimer();
    this.phase = phase;
    this.phaseDurationMs = durationMs;
    this.phaseEndsAt = durationMs !== null ? this.now() + durationMs : null;
    this.pendingHandler = onEnd;
    if (durationMs !== null && onEnd) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.pendingHandler = null;
        onEnd();
      }, durationMs);
    }
    this.broadcast();
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pendingHandler = null;
  }

  // ---------------------------------------------------------------- templates

  private availableTemplates(): MemeTemplate[] {
    const ids = new Set(this.settings.packIds);
    return this.opts.packs.filter((p) => ids.has(p.id)).flatMap((p) => p.templates);
  }

  private usedThisRound(): string[] {
    return [...this.assignments.values()].map((a) => a.template.id);
  }

  /** Pioche dans un paquet mélangé : pas de doublon tant que le paquet n'est pas épuisé. */
  private drawTemplate(exclude: Set<string>): MemeTemplate | null {
    const all = this.availableTemplates();
    if (all.length === 0) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const idx = this.deck.findIndex((t) => !exclude.has(t.id));
      if (idx !== -1) return this.deck.splice(idx, 1)[0];
      this.deck = this.shuffle([...all]);
    }
    // Moins de templates que de joueurs : on accepte les doublons.
    return all[Math.floor(this.random() * all.length)];
  }

  // ---------------------------------------------------------------- vues

  private broadcast() {
    for (const p of this.players.values()) this.sendView(p);
  }

  private sendView(player: Player) {
    if (!player.connId) return;
    this.connections.get(player.connId)?.send({ t: 'view', view: this.buildView(player) });
  }

  private buildView(player: Player): GameView {
    const a = this.assignments.get(player.id);
    const anonymous = this.settings.votingEnabled && (this.phase === 'reveal' || this.phase === 'voting');
    let submissions: Submission[] = [];
    if (this.phase === 'reveal') submissions = this.submissions.slice(0, this.revealIndex + 1);
    else if (this.phase === 'voting' || this.phase === 'roundResults') submissions = this.submissions;
    if (anonymous) {
      submissions = submissions.map((s) =>
        s.playerId === player.id ? s : { ...s, playerId: '', playerName: '???' },
      );
    }
    return {
      phase: this.phase,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        connected: !!p.connId,
        isHost: p.isHost,
        score: p.score,
        avatarId: p.avatarId,
        ready: !!this.assignments.get(p.id)?.ready,
      })),
      settings: this.settings,
      packs: this.opts.packs.map((p) => ({ id: p.id, name: p.name, count: p.templates.length })),
      round: this.round,
      remainingMs: this.phaseEndsAt !== null ? Math.max(0, this.phaseEndsAt - this.now()) : null,
      phaseDurationMs: this.phaseDurationMs,
      me:
        this.phase === 'writing' && a
          ? { template: a.template, captions: a.captions, ready: a.ready, rerollsLeft: a.rerollsLeft }
          : null,
      submissions,
      revealIndex: this.revealIndex,
      myVote: this.votes.get(player.id) ?? null,
      history: this.phase === 'final' ? this.history : [],
    };
  }

  // ---------------------------------------------------------------- utilitaires

  private uniqueName(raw: string): string {
    const base = String(raw || '').trim().slice(0, MAX_NAME_LENGTH) || 'Joueur';
    const taken = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) {
      const candidate = `${base} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  private newId(prefix: string) {
    this.idCounter += 1;
    return `${prefix}${this.idCounter.toString(36)}${Math.floor(this.random() * 1e6).toString(36)}`;
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
