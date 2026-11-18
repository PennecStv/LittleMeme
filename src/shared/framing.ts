import { Buffer } from 'buffer';

// Les messages circulent en JSON, un par ligne (NDJSON).
// On découpe sur l'octet '\n' AVANT de décoder l'UTF-8 : un caractère accentué
// coupé entre deux paquets TCP ne peut donc jamais être corrompu.

const NEWLINE = 0x0a;

export function encodeMessage(msg: unknown): string {
  return JSON.stringify(msg) + '\n';
}

export class LineDecoder {
  private chunks: Uint8Array[] = [];

  constructor(private onLine: (line: string) => void) {}

  push(data: Buffer | Uint8Array | string) {
    let buf: Uint8Array = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    let idx = buf.indexOf(NEWLINE);
    while (idx !== -1) {
      this.chunks.push(buf.subarray(0, idx));
      const line = Buffer.concat(this.chunks).toString('utf8');
      this.chunks = [];
      if (line.length > 0) this.onLine(line);
      buf = buf.subarray(idx + 1);
      idx = buf.indexOf(NEWLINE);
    }
    if (buf.length > 0) this.chunks.push(buf);
  }
}

export function safeParse<T>(line: string): T | null {
  try {
    return JSON.parse(line) as T;
  } catch {
    return null;
  }
}
