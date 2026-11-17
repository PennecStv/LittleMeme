import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { GameClient } from '../../net/GameClient';
import { GameView } from '../../shared/types';
import { colors, fonts, radius, space, themed } from '../theme';
import { PlayerAvatar } from '../Avatar';
import { Card, Label } from '../ui';

export function PlayerList({
  client,
  view,
  isHost,
  title,
  showReady,
  showScores,
}: {
  client: GameClient;
  view: GameView;
  isHost: boolean;
  title: string;
  showReady?: boolean;
  showScores?: boolean;
}) {
  const me = client.getSnapshot().playerId;
  const players = showScores ? [...view.players].sort((a, b) => b.score - a.score) : view.players;

  const kick = (id: string, name: string) =>
    Alert.alert(`Retirer ${name} ?`, undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => client.send({ t: 'kick', playerId: id }) },
    ]);

  return (
    <Card>
      <Label>{title}</Label>
      <View style={styles.list}>
        {players.map((p) => (
          <View key={p.id} style={[styles.chip, !p.connected && { opacity: 0.4 }, p.id === me && styles.me]}>
            <PlayerAvatar client={client} player={p} size={28} />
            <Text style={styles.name} numberOfLines={1}>
              {p.isHost ? '👑 ' : ''}
              {p.name}
              {!p.connected ? ' (déco)' : ''}
            </Text>
            {showReady && <Text>{p.ready ? '✅' : '✍️'}</Text>}
            {showScores && <Text style={styles.score}>{p.score}</Text>}
            {isHost && !p.isHost && view.phase === 'lobby' && (
              <Pressable hitSlop={10} onPress={() => kick(p.id, p.name)}>
                <Text style={styles.kick}>✕</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    list: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: 6,
      paddingLeft: 6,
      paddingRight: space.sm + 4,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceAlt,
      maxWidth: '100%',
    },
    me: { borderWidth: 1, borderColor: colors.accent },
    name: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, flexShrink: 1 },
    score: { color: colors.accent, fontFamily: fonts.display },
    kick: { color: colors.muted, fontSize: 16, fontFamily: fonts.bold },
  }),
);
