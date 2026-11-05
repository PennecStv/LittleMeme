import * as Network from 'expo-network';
import { useSyncExternalStore } from 'react';
import TcpSocket from 'react-native-tcp-socket';
import { GameClient } from '../net/GameClient';
import { HostServer } from '../net/HostServer';
import { NetModule } from '../net/netTypes';
import { TcpClientTransport } from '../net/transport';
import { ipToRoomCode, roomCodeToIp } from '../shared/roomCode';
import { GAME_PORT } from '../shared/types';
import { getAllPacks, readTemplateImage } from '../storage/packs';
import { getProfile, readAvatarData, updateProfile } from '../storage/profile';
import { rotateHomeText } from '../data/homeTexts';

// Une seule partie à la fois : on garde le client (et le serveur si on héberge) ici.

const rnNet: NetModule = {
  createServer: (listener) => TcpSocket.createServer(listener as any) as any,
  createConnection: ({ host, port, connectTimeout }, cb) =>
    TcpSocket.createConnection({ host, port, connectTimeout }, cb ?? (() => {})) as any,
};

type Session = {
  client: GameClient;
  server: HostServer | null;
  /** Renseigné quand on héberge. */
  ip: string | null;
  roomCode: string | null;
};

let current: Session | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((cb) => cb());

export function getSession() {
  return current;
}

export function useSession() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

export function useGameSnapshot(client: GameClient) {
  return useSyncExternalStore(client.subscribe, client.getSnapshot);
}

export async function getLocalIp(): Promise<string | null> {
  try {
    const ip = await Network.getIpAddressAsync();
    return ip && ip !== '0.0.0.0' ? ip : null;
  } catch {
    return null;
  }
}

export async function hostGame(): Promise<Session> {
  leaveGame();
  const profile = getProfile();
  const ip = await getLocalIp();
  if (!ip) throw new Error("Pas d'adresse IP : connecte-toi à un réseau Wifi (ou active le partage de connexion).");

  const server = new HostServer(rnNet, {
    packs: getAllPacks(),
    getAsset: readTemplateImage,
    initialSettings: profile.lastSettings,
    onSettingsChange: (s) => updateProfile({ lastSettings: s }),
  });
  try {
    await server.start();
  } catch (e: any) {
    throw new Error(`Impossible de démarrer le serveur (${e?.message ?? e}).`);
  }
  const client = new GameClient(async () => server.createLocalTransport(), profile.playerId, profile.name, false, await readAvatarData());
  await client.connect();
  current = { client, server, ip, roomCode: ipToRoomCode(ip) };
  emit();
  return current;
}

export async function joinGame(codeOrIp: string): Promise<Session> {
  leaveGame();
  const ip = roomCodeToIp(codeOrIp);
  if (!ip) throw new Error('Code de salle invalide.');
  const profile = getProfile();
  const client = new GameClient(
    () => TcpClientTransport.connect(rnNet, ip, GAME_PORT),
    profile.playerId,
    profile.name,
    true,
    await readAvatarData(),
  );
  try {
    await client.connect();
  } catch {
    throw new Error("Impossible de rejoindre la partie. Vérifie le code et que vous êtes sur le même Wifi.");
  }
  current = { client, server: null, ip: null, roomCode: null };
  emit();
  return current;
}

export function leaveGame() {
  if (!current) return;
  current.client.leave();
  current.server?.stop();
  current = null;
  // Nouvelle phrase sur l'accueil après chaque partie.
  rotateHomeText();
  emit();
}
