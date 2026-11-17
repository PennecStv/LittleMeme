import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { GameClient } from '../../net/GameClient';
import { GameSettings, GameView, SETTINGS_LIMITS } from '../../shared/types';
import { colors, fonts, radius, space, themed } from '../theme';
import { Body, Button, Card, formatSeconds, Label, Stepper, ToggleRow } from '../ui';
import { PlayerList } from './PlayerList';

export const QR_PREFIX = 'LITTLEMEME:';

export function Lobby({
  client,
  view,
  isHost,
  roomCode,
  ip,
}: {
  client: GameClient;
  view: GameView;
  isHost: boolean;
  roomCode: string | null;
  ip: string | null;
}) {
  const s = view.settings;
  const set = (patch: Partial<GameSettings>) => client.send({ t: 'settings', settings: patch });
  const templateCount = view.packs.filter((p) => s.packIds.includes(p.id)).reduce((n, p) => n + p.count, 0);

  const togglePack = (id: string) => {
    const next = s.packIds.includes(id) ? s.packIds.filter((p) => p !== id) : [...s.packIds, id];
    set({ packIds: next });
  };

  return (
    <>
      {isHost && roomCode && (
        <Card style={styles.codeCard}>
          <Label>Code de la salle</Label>
          <Text style={styles.code} selectable>
            {roomCode}
          </Text>
          <View style={styles.qr}>
            <QRCode value={`${QR_PREFIX}${ip}`} size={150} backgroundColor="#fff" color="#000" />
          </View>
          <Body muted style={{ textAlign: 'center' }}>
            Tes potes ouvrent l'app → « Rejoindre » → tapent ce code ou scannent le QR.{'\n'}Vous devez être sur le même Wifi.
          </Body>
        </Card>
      )}
      {!isHost && (
        <Card style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 40 }}>⏳</Text>
          <Body style={{ textAlign: 'center' }}>En attente que l'hôte lance la partie…</Body>
        </Card>
      )}

      <PlayerList client={client} view={view} isHost={isHost} title={`Joueurs (${view.players.length})`} />

      <Card>
        <Label>Paramètres {isHost ? '' : "(choisis par l'hôte)"}</Label>
        <Stepper
          label="Manches"
          value={s.rounds}
          {...SETTINGS_LIMITS.rounds}
          onChange={(v) => set({ rounds: v })}
          disabled={!isHost}
        />
        <Stepper
          label="Temps d'écriture"
          value={s.writeSeconds}
          {...SETTINGS_LIMITS.writeSeconds}
          format={formatSeconds}
          onChange={(v) => set({ writeSeconds: v })}
          disabled={!isHost}
        />
        <Stepper
          label="Présentation (par meme)"
          value={s.revealSeconds}
          {...SETTINGS_LIMITS.revealSeconds}
          format={formatSeconds}
          onChange={(v) => set({ revealSeconds: v })}
          disabled={!isHost}
        />
        <ToggleRow label="Votes" value={s.votingEnabled} onChange={(v) => set({ votingEnabled: v })} disabled={!isHost} />
        {s.votingEnabled && (
          <Stepper
            label="Temps de vote"
            value={s.voteSeconds}
            {...SETTINGS_LIMITS.voteSeconds}
            format={formatSeconds}
            onChange={(v) => set({ voteSeconds: v })}
            disabled={!isHost}
          />
        )}
        <Stepper
          label="Récap entre manches"
          value={s.recapSeconds}
          {...SETTINGS_LIMITS.recapSeconds}
          format={formatSeconds}
          onChange={(v) => set({ recapSeconds: v })}
          disabled={!isHost}
        />
        <Stepper
          label="Changements de meme"
          value={s.rerolls}
          {...SETTINGS_LIMITS.rerolls}
          onChange={(v) => set({ rerolls: v })}
          disabled={!isHost}
        />
      </Card>

      <Card>
        <Label>Packs de memes</Label>
        {view.packs.map((p) => {
          const on = s.packIds.includes(p.id);
          return (
            <Pressable key={p.id} disabled={!isHost} onPress={() => togglePack(p.id)} style={[styles.pack, on && styles.packOn]}>
              <Text style={styles.packCheck}>{on ? '✅' : '⬜'}</Text>
              <Text style={styles.packName} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.packCount}>{p.count}</Text>
            </Pressable>
          );
        })}
        {isHost && <Body muted>Crée tes propres packs (photos de tes potes…) depuis l'accueil → « Mes packs ».</Body>}
      </Card>

      {isHost && (
        <View style={{ gap: space.sm }}>
          {view.players.length < 2 && (
            <Body muted style={{ textAlign: 'center' }}>
              Tu peux lancer seul pour tester, mais c'est plus drôle à plusieurs 😉
            </Body>
          )}
          {templateCount === 0 && (
            <Body style={{ textAlign: 'center', color: colors.danger }}>Active au moins un pack non vide.</Body>
          )}
          <Button title="Lancer la partie" onPress={() => client.send({ t: 'start' })} disabled={templateCount === 0} />
        </View>
      )}
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    codeCard: { alignItems: 'center' },
    code: { fontFamily: fonts.display, fontSize: 64, color: colors.accent, letterSpacing: 8 },
    qr: { padding: 10, backgroundColor: '#fff', borderRadius: radius.sm },
    pack: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      padding: space.sm + 2,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
    },
    packOn: { borderWidth: 1, borderColor: colors.accent },
    packCheck: { fontSize: 18 },
    packName: { color: colors.text, fontSize: 16, flex: 1, fontFamily: fonts.semibold },
    packCount: { color: colors.muted, fontFamily: fonts.bold },
  }),
);
