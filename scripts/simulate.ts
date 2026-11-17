/// <reference types="node" />
// Simulation d'une partie complète en TCP réel (Node), sans téléphone.
// Lancer : npm run simulate
import assert from 'node:assert/strict';
import net from 'node:net';
import { GameClient } from '../src/net/GameClient';
import { HostServer } from '../src/net/HostServer';
import { NetModule } from '../src/net/netTypes';
import { TcpClientTransport } from '../src/net/transport';
import { ipToRoomCode, roomCodeToIp } from '../src/shared/roomCode';
import { GameView, MemePack, Phase } from '../src/shared/types';
import { BUILTIN_PACK } from '../src/data/builtinPack';
import { parseMemegenZones } from '../src/shared/memegen';

const nodeNet: NetModule = {
  createServer: (listener) => net.createServer(listener as any) as any,
  createConnection: ({ host, port }, cb) => net.createConnection({ host, port }, cb) as any,
};

const PORT = 47999;

function waitFor(client: GameClient, pred: (v: GameView) => boolean, label: string, timeout = 25000) {
  return new Promise<GameView>((resolve, reject) => {
    const check = () => {
      const v = client.getSnapshot().view;
      if (v && pred(v)) {
        unsub();
        clearTimeout(t);
        resolve(v);
      }
    };
    const unsub = client.subscribe(check);
    const t = setTimeout(() => {
      unsub();
      reject(new Error(`timeout en attendant: ${label} (phase=${client.getSnapshot().view?.phase})`));
    }, timeout);
    check();
  });
}
const phaseIs = (p: Phase) => (v: GameView) => v.phase === p;

async function main() {
  // --- codes de salle
  for (const ip of ['192.168.1.42', '192.168.0.1', '10.0.0.7', '172.20.10.1', '100.64.3.9', '255.255.255.255']) {
    const code = ipToRoomCode(ip)!;
    assert.equal(roomCodeToIp(code), ip, `code ${code} pour ${ip}`);
    assert.equal(roomCodeToIp(code.toLowerCase()), ip);
  }
  assert.equal(ipToRoomCode('192.168.1.42')!.length, 4);
  console.log('✓ codes de salle', ipToRoomCode('192.168.1.42'), ipToRoomCode('172.20.10.1'));

  // --- parseur des zones memegen
  const yml = `name: Test
text:
  - style: upper
    color: black
    anchor_x: 0.5
    anchor_y: 0.1
    scale_x: 0.8
    scale_y: 0.3
  - anchor_y: 0.8
example:
  - a
`;
  const round = (zs: ReturnType<typeof parseMemegenZones>) => zs.map((z) => ({ ...z, w: +z.w.toFixed(3), h: +z.h.toFixed(3) }));
  assert.deepEqual(round(parseMemegenZones(yml, 2)), [
    { x: 0.5, y: 0.1, w: 0.5, h: 0.3, style: 'plain' },
    { x: 0, y: 0.8, w: 1, h: 0.2, style: 'outline' },
  ]);
  assert.deepEqual(parseMemegenZones('', 2).map((z) => z.y), [0, 0.8]);
  console.log('✓ zones memegen');

  // --- pack avec image + pack intégré
  const photoPack: MemePack = {
    id: 'perso',
    name: 'Pack perso',
    templates: [{ id: 'perso-1', name: 'Photo de Kevin', aspect: 1, hasImage: true, zones: [{ x: 0, y: 0, w: 1, h: 0.2 }] }],
  };
  const bigImage = 'data:image/jpeg;base64,' + Buffer.alloc(300_000, 7).toString('base64');

  const host = new HostServer(
    nodeNet,
    {
      packs: [BUILTIN_PACK, photoPack],
      getAsset: async (id) => (id === 'perso-1' ? bigImage : null),
    },
    PORT,
  );
  await host.start();

  const hostClient = new GameClient(async () => host.createLocalTransport(), 'host-id', 'Steve', false);
  await hostClient.connect();

  const bots: GameClient[] = [];
  for (const name of ['Kévin', 'Léa', 'Kévin']) {
    const avatar = bots.length === 0 ? 'data:image/jpeg;base64,QVZBVEFS' : undefined;
    const c = new GameClient(() => TcpClientTransport.connect(nodeNet, '127.0.0.1', PORT), `id-${bots.length}`, name, true, avatar);
    await c.connect();
    bots.push(c);
  }
  const lobby = await waitFor(hostClient, (v) => v.players.length === 4, '4 joueurs dans le lobby');
  assert.deepEqual(lobby.players.map((p) => p.name), ['Steve', 'Kévin', 'Léa', 'Kévin 2']);
  assert.equal(hostClient.getSnapshot().isHost, true);
  assert.equal(bots[0].getSnapshot().isHost, false);
  const kevin = lobby.players[1];
  assert.ok(kevin.avatarId && !lobby.players[2].avatarId, 'photo de profil annoncée');
  await new Promise<void>((resolve) => {
    const unsub = bots[1].subscribeAssets(() => bots[1].getAsset(kevin.avatarId!) && (unsub(), resolve()));
    bots[1].getAsset(kevin.avatarId!);
  });
  assert.equal(bots[1].getAsset(kevin.avatarId!), 'data:image/jpeg;base64,QVZBVEFS');
  console.log('✓ lobby :', lobby.players.map((p) => p.name).join(', '));

  // un non-hôte ne peut pas changer les paramètres
  bots[0].send({ t: 'settings', settings: { rounds: 9 } });
  hostClient.send({ t: 'settings', settings: { rounds: 2, writeSeconds: 1, revealSeconds: 1, votingEnabled: true, voteSeconds: 999, recapSeconds: 1 } });
  const s = await waitFor(hostClient, (v) => v.settings.rounds === 2, 'paramètres');
  assert.equal(s.settings.writeSeconds, 15, 'bornes min appliquées');
  assert.equal(s.settings.voteSeconds, 90, 'bornes max appliquées');

  // transfert d'une grosse image (plusieurs paquets TCP)
  const assetPromise = new Promise<void>((resolve) => {
    const unsub = bots[1].subscribeAssets(() => {
      if (bots[1].getAsset('perso-1')) {
        unsub();
        resolve();
      }
    });
  });
  bots[1].getAsset('perso-1');
  await assetPromise;
  assert.equal(bots[1].getAsset('perso-1'), bigImage);
  console.log('✓ image de', Math.round(bigImage.length / 1024), 'Ko transférée');

  const everyone = [hostClient, ...bots];
  hostClient.send({ t: 'start' });

  for (let round = 1; round <= 2; round++) {
    const views = await Promise.all(everyone.map((c) => waitFor(c, (v) => v.phase === 'writing' && v.round === round, `écriture manche ${round}`)));
    const templateIds = views.map((v) => v.me!.template.id);
    assert.equal(new Set(templateIds).size, 4, 'chaque joueur a un meme différent');

    // reroll
    const before = views[1].me!.template.id;
    bots[0].send({ t: 'reroll' });
    const rerolled = await waitFor(bots[0], (v) => v.me?.template.id !== before && v.me?.rerollsLeft === 0, 'reroll');
    assert.notEqual(rerolled.me!.template.id, before);

    // tout le monde écrit (sauf Léa qui n'écrit rien) puis valide -> fin anticipée
    everyone.forEach((c, i) => {
      const me = c.getSnapshot().view!.me!;
      if (i !== 2) c.send({ t: 'captions', captions: me.template.zones.map((_, z) => `Manche ${round} — ${i} — zone ${z} éàü`) });
      c.send({ t: 'ready', ready: true });
    });

    // la révélation est anonyme quand le vote est activé
    const reveal = await waitFor(bots[1], phaseIs('reveal'), 'révélation');
    assert.ok(reveal.submissions.every((sub) => sub.playerName === '???' || sub.playerId === bots[1].getSnapshot().playerId));

    const voting = await waitFor(hostClient, phaseIs('voting'), 'vote');
    assert.equal(voting.submissions.length, 3, 'le meme vide de Léa est ignoré');
    for (const c of everyone) {
      const myId = c.getSnapshot().playerId;
      const target = voting.submissions.find((sub) => {
        const full = c.getSnapshot().view!.submissions.find((x) => x.id === sub.id)!;
        return full.playerId !== myId;
      })!;
      c.send({ t: 'vote', submissionId: target.id });
    }
    const results = await waitFor(hostClient, phaseIs('roundResults'), 'résultats');
    assert.equal(results.submissions.reduce((n, sub) => n + sub.votes, 0), 4, '4 votes comptés');
    assert.ok(results.submissions.every((sub) => sub.playerName !== '???'), 'noms révélés');
    assert.ok(results.submissions[0].captions[0].includes('éàü'), 'accents préservés');
    console.log(`✓ manche ${round} :`, results.submissions.map((sub) => `${sub.playerName}=${sub.votes}`).join(' '));
  }

  const final = await waitFor(hostClient, phaseIs('final'), 'fin de partie');
  assert.equal(final.history.length, 2);
  assert.equal(final.players.reduce((n, p) => n + p.score, 0), 8);
  console.log('✓ récap final :', final.players.map((p) => `${p.name} ${p.score}pts`).join(', '));

  // reconnexion d'un joueur
  hostClient.send({ t: 'backToLobby' });
  await waitFor(hostClient, phaseIs('lobby'), 'retour lobby');
  hostClient.send({ t: 'kick', playerId: bots[2].getSnapshot().playerId });
  await waitFor(hostClient, (v) => v.players.length === 3, 'joueur exclu');
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(bots[2].getSnapshot().status, 'closed', 'le joueur exclu est déconnecté');
  assert.match(bots[2].getSnapshot().error ?? '', /retiré/);
  console.log('✓ retour au lobby + exclusion');

  everyone.forEach((c) => c.leave());
  host.stop();
  console.log('\nTout est OK ✅');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
