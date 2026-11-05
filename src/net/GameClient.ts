import { ClientMessage, GameView, HostMessage, PROTOCOL_VERSION } from '../shared/types';
import { ClientTransport } from './transport';

export type ClientStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

export type ClientSnapshot = {
  status: ClientStatus;
  playerId: string;
  isHost: boolean;
  view: GameView | null;
  /** Date.now() locale à laquelle la phase en cours se termine (corrige le décalage d'horloge entre téléphones). */
  deadline: number | null;
  error: string | null;
};

const RECONNECT_ATTEMPTS = 8;
const RECONNECT_DELAY_MS = 1500;

/** État de la partie côté joueur, alimenté par les messages de l'hôte. */
export class GameClient {
  private transport: ClientTransport | null = null;
  private listeners = new Set<() => void>();
  private assetListeners = new Set<() => void>();
  private assets = new Map<string, string | null>();
  private pendingAssets = new Set<string>();
  private leaving = false;
  private snapshot: ClientSnapshot;

  constructor(
    private connectTransport: () => Promise<ClientTransport>,
    private playerId: string,
    private name: string,
    private canReconnect: boolean,
    private avatar?: string,
  ) {
    this.snapshot = { status: 'connecting', playerId, isHost: false, view: null, deadline: null, error: null };
  }

  async connect(): Promise<void> {
    const transport = await this.connectTransport();
    this.attach(transport);
  }

  getSnapshot = () => this.snapshot;

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  send(msg: ClientMessage) {
    this.transport?.send(msg);
  }

  leave() {
    this.leaving = true;
    this.transport?.close();
    this.transport = null;
    this.update({ status: 'closed' });
  }

  // ---------------------------------------------------------------- images

  getAsset(id: string): string | null | undefined {
    if (!this.assets.has(id) && !this.pendingAssets.has(id)) {
      this.pendingAssets.add(id);
      this.send({ t: 'getAsset', id });
    }
    return this.assets.get(id);
  }

  subscribeAssets = (cb: () => void) => {
    this.assetListeners.add(cb);
    return () => this.assetListeners.delete(cb);
  };

  // ---------------------------------------------------------------- interne

  private attach(transport: ClientTransport) {
    this.transport = transport;
    transport.onMessage = (msg) => this.handle(msg);
    transport.onClose = () => this.handleClose(transport);
    transport.send({ t: 'hello', playerId: this.playerId, name: this.name, protocol: PROTOCOL_VERSION, avatar: this.avatar });
    // Les demandes d'images en cours sont perdues avec l'ancienne connexion.
    for (const id of this.pendingAssets) transport.send({ t: 'getAsset', id });
  }

  private handle(msg: HostMessage) {
    switch (msg.t) {
      case 'welcome':
        this.playerId = msg.playerId;
        this.update({ status: 'connected', playerId: msg.playerId, isHost: msg.isHost, error: null });
        break;
      case 'view':
        this.update({
          view: msg.view,
          deadline: msg.view.remainingMs !== null ? Date.now() + msg.view.remainingMs : null,
        });
        break;
      case 'asset':
        this.pendingAssets.delete(msg.id);
        this.assets.set(msg.id, msg.data);
        this.assetListeners.forEach((cb) => cb());
        break;
      case 'error':
        if (msg.fatal) {
          this.leaving = true;
          this.update({ status: 'closed', error: msg.message });
          this.transport?.close();
        } else {
          this.update({ error: msg.message });
        }
        break;
    }
  }

  private async handleClose(transport: ClientTransport) {
    if (this.transport !== transport) return;
    this.transport = null;
    if (this.leaving || !this.canReconnect) {
      this.update({ status: 'closed', error: this.snapshot.error ?? (this.leaving ? null : 'Connexion perdue.') });
      return;
    }
    this.update({ status: 'reconnecting' });
    for (let i = 0; i < RECONNECT_ATTEMPTS && !this.leaving; i++) {
      await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
      if (this.leaving) return;
      try {
        this.attach(await this.connectTransport());
        return;
      } catch {
        // on réessaie
      }
    }
    if (!this.leaving) this.update({ status: 'closed', error: "Impossible de joindre l'hôte. La partie est peut-être terminée." });
  }

  private update(patch: Partial<ClientSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((cb) => cb());
  }
}
