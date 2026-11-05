// Code de salle = adresse IP de l'hôte encodée de façon compacte.
// La longueur du code indique la plage d'adresses privée :
//   4 caractères -> 192.168.x.y   (la plupart des box Wifi)
//   5 caractères -> 10.x.y.z
//   6 caractères -> 172.16-31.x.y (ex. partage de connexion iPhone)
//   7 caractères -> n'importe quelle IPv4

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // pas de 0/O ni 1/I

function toBase32(value: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out = ALPHABET[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

function fromBase32(code: string): number | null {
  let value = 0;
  for (const ch of code) {
    const digit = ALPHABET.indexOf(ch);
    if (digit === -1) return null;
    value = value * 32 + digit;
  }
  return value;
}

function parseIp(ip: string): number[] | null {
  const parts = ip.trim().split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return parts;
}

export function ipToRoomCode(ip: string): string | null {
  const p = parseIp(ip);
  if (!p) return null;
  if (p[0] === 192 && p[1] === 168) return toBase32(p[2] * 256 + p[3], 4);
  if (p[0] === 10) return toBase32(p[1] * 65536 + p[2] * 256 + p[3], 5);
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return toBase32((p[1] - 16) * 65536 + p[2] * 256 + p[3], 6);
  return toBase32(((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3], 7);
}

export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Accepte un code de salle ou directement une adresse IP. */
export function roomCodeToIp(input: string): string | null {
  if (parseIp(input)) return input.trim();
  const code = normalizeRoomCode(input);
  const v = fromBase32(code);
  if (v === null) return null;
  switch (code.length) {
    case 4:
      return v < 65536 ? `192.168.${v >> 8}.${v & 255}` : null;
    case 5:
      return v < 2 ** 24 ? `10.${(v >> 16) & 255}.${(v >> 8) & 255}.${v & 255}` : null;
    case 6:
      return v < 2 ** 20 ? `172.${16 + ((v >> 16) & 15)}.${(v >> 8) & 255}.${v & 255}` : null;
    case 7: {
      if (v >= 2 ** 32) return null;
      const a = Math.floor(v / 2 ** 24);
      return `${a}.${(v >> 16) & 255}.${(v >> 8) & 255}.${v & 255}`;
    }
    default:
      return null;
  }
}
