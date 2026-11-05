import { Directory, File, Paths } from 'expo-file-system';

export function ensureDir(...parts: string[]): Directory {
  const dir = new Directory(Paths.document, ...parts);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function readJson<T>(file: File, fallback: T): T {
  try {
    if (!file.exists) return fallback;
    return JSON.parse(file.textSync()) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(file: File, value: unknown) {
  if (!file.exists) file.create({ intermediates: true });
  file.writeSync(JSON.stringify(value));
}

export function randomId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Petit store observable pour rafraîchir les écrans quand les données changent. */
export function createSignal() {
  const listeners = new Set<() => void>();
  let version = 0;
  return {
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getVersion: () => version,
    emit: () => {
      version += 1;
      listeners.forEach((cb) => cb());
    },
  };
}
