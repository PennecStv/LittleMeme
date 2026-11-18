import { encodeMessage, LineDecoder, safeParse } from '../shared/framing';
import { ClientMessage, HostMessage } from '../shared/types';
import { NetModule, NetSocket } from './netTypes';

/** Canal côté client vers l'hôte. */
export interface ClientTransport {
  send(msg: ClientMessage): void;
  close(): void;
  onMessage: (msg: HostMessage) => void;
  onClose: (reason?: string) => void;
}

/** Transport TCP vers un hôte distant. */
export class TcpClientTransport implements ClientTransport {
  onMessage: (msg: HostMessage) => void = () => {};
  onClose: (reason?: string) => void = () => {};
  private socket: NetSocket;
  private closed = false;

  private constructor(socket: NetSocket) {
    this.socket = socket;
    const decoder = new LineDecoder((line) => {
      const msg = safeParse<HostMessage>(line);
      if (msg) this.onMessage(msg);
    });
    socket.on('data', (d) => decoder.push(d));
    socket.on('close', () => this.finish());
    socket.on('error', (err) => this.finish(err?.message));
  }

  static connect(net: NetModule, host: string, port: number, timeoutMs = 6000): Promise<TcpClientTransport> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const socket = net.createConnection({ host, port, connectTimeout: timeoutMs }, () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.setNoDelay?.(true);
        resolve(new TcpClientTransport(socket));
      });
      const fail = (reason: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(new Error(reason));
      };
      const timer = setTimeout(() => fail('timeout'), timeoutMs);
      socket.on('error', (err) => fail(err?.message ?? 'error'));
      socket.on('close', () => fail('closed'));
    });
  }

  send(msg: ClientMessage) {
    if (!this.closed) this.socket.write(encodeMessage(msg));
  }

  close() {
    this.finish();
  }

  private finish(reason?: string) {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy();
    this.onClose(reason);
  }
}
