// Sous-ensemble de l'API "net" de Node, implémenté aussi par react-native-tcp-socket.
// Ça permet de faire tourner exactement le même code réseau dans Node (tests) et sur téléphone.

export interface NetSocket {
  on(event: 'data', cb: (data: any) => void): unknown;
  on(event: 'close', cb: () => void): unknown;
  on(event: 'error', cb: (err: Error) => void): unknown;
  on(event: 'connect', cb: () => void): unknown;
  write(data: string): unknown;
  destroy(): unknown;
  setNoDelay?(noDelay?: boolean): unknown;
}

export interface NetServer {
  listen(options: { port: number; host?: string; reuseAddress?: boolean }, cb?: () => void): unknown;
  on(event: 'error', cb: (err: Error) => void): unknown;
  close(cb?: (err?: Error) => void): unknown;
}

export interface NetModule {
  createServer(listener: (socket: NetSocket) => void): NetServer;
  createConnection(options: { host: string; port: number; connectTimeout?: number }, cb?: () => void): NetSocket;
}
