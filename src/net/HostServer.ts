import { Connection, EngineOptions, GameEngine } from '../engine/GameEngine';
import { encodeMessage, LineDecoder, safeParse } from '../shared/framing';
import { ClientMessage, GAME_PORT, HostMessage } from '../shared/types';
import { NetModule, NetServer } from './netTypes';
import { ClientTransport } from './transport';

/** Fait tourner le moteur de jeu et accepte les connexions TCP des autres joueurs. */
export class HostServer {
  readonly engine: GameEngine;
  private server: NetServer | null = null;
  private nextConnId = 1;

  constructor(private net: NetModule, engineOptions: EngineOptions, readonly port = GAME_PORT) {
    this.engine = new GameEngine(engineOptions);
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.net.createServer((socket) => {
        const id = `tcp${this.nextConnId++}`;
        let open = true;
        socket.setNoDelay?.(true);
        const conn: Connection = {
          id,
          isLocal: false,
          send: (msg) => {
            if (open) socket.write(encodeMessage(msg));
          },
          close: () => {
            if (open) socket.destroy();
          },
        };
        const decoder = new LineDecoder((line) => {
          const msg = safeParse<ClientMessage>(line);
          if (msg) this.engine.receive(id, msg);
        });
        const onGone = () => {
          if (!open) return;
          open = false;
          this.engine.disconnect(id);
        };
        socket.on('data', (d) => decoder.push(d));
        socket.on('close', onGone);
        socket.on('error', onGone);
        this.engine.connect(conn);
      });
      let listening = false;
      server.on('error', (err) => {
        if (!listening) reject(err);
      });
      server.listen({ port: this.port, host: '0.0.0.0', reuseAddress: true }, () => {
        listening = true;
        resolve();
      });
      this.server = server;
    });
  }

  /** Connexion du joueur qui héberge, sans passer par le réseau. */
  createLocalTransport(): ClientTransport {
    const id = `local${this.nextConnId++}`;
    let open = true;
    const transport: ClientTransport = {
      onMessage: () => {},
      onClose: () => {},
      send: (msg) => {
        // Copie JSON pour garder exactement la même sémantique que sur le réseau.
        if (open) queueMicrotask(() => this.engine.receive(id, JSON.parse(JSON.stringify(msg))));
      },
      close: () => {
        if (!open) return;
        open = false;
        this.engine.disconnect(id);
        transport.onClose();
      },
    };
    this.engine.connect({
      id,
      isLocal: true,
      send: (msg: HostMessage) => {
        if (open) {
          const copy = JSON.parse(JSON.stringify(msg));
          queueMicrotask(() => transport.onMessage(copy));
        }
      },
      close: () => transport.close(),
    });
    return transport;
  }

  stop() {
    this.engine.dispose();
    this.server?.close();
    this.server = null;
  }
}
