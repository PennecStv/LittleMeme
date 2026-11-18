import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GameClient } from '../../net/GameClient';
import { GameView, Submission } from '../../shared/types';
import { MemeView, useTemplateImage } from '../MemeView';
import { SaveableMeme } from '../SaveableMeme';
import { colors, fonts, radius, space, themed } from '../theme';
import { Body, Button, Card, Label, Title } from '../ui';
import { PlayerAvatar } from '../Avatar';
import { PlayerList } from './PlayerList';

// ------------------------------------------------------------------ présentation

export function Reveal({ client, view, width }: { client: GameClient; view: GameView; width: number }) {
  const current = view.submissions[view.revealIndex];
  const image = useTemplateImage(client, current?.template ?? { id: '', name: '', aspect: 1, zones: [], hasImage: false });
  if (!current) return null;
  const mine = current.playerId === client.getSnapshot().playerId;
  return (
    <>
      <Label style={{ textAlign: 'center' }}>
        Meme {view.revealIndex + 1}
        {view.revealIndex + 1 >= view.submissions.length ? ' — le dernier !' : ''}
      </Label>
      <View key={current.id} style={styles.memeShadow}>
        <MemeView template={current.template} captions={current.captions} width={width} imageUri={image} />
      </View>
      <Text style={styles.author}>{mine ? 'Ton meme' : `par ${current.playerName}`}</Text>
    </>
  );
}

// ------------------------------------------------------------------ vote

function VoteCard({
  client,
  sub,
  width,
  selected,
  mine,
  onPress,
}: {
  client: GameClient;
  sub: Submission;
  width: number;
  selected: boolean;
  mine: boolean;
  onPress: () => void;
}) {
  const image = useTemplateImage(client, sub.template);
  return (
    <Pressable
      onPress={onPress}
      disabled={mine}
      style={[styles.voteCard, selected && styles.voteSelected, mine && { opacity: 0.5 }]}
    >
      <MemeView template={sub.template} captions={sub.captions} width={width} imageUri={image} />
      <Text style={styles.voteLabel}>{mine ? 'Ton meme' : selected ? 'Ton vote' : 'Voter'}</Text>
    </Pressable>
  );
}

export function Voting({ client, view, width }: { client: GameClient; view: GameView; width: number }) {
  const me = client.getSnapshot().playerId;
  const colWidth = Math.floor((width - space.sm) / 2) - 6;
  return (
    <>
      <Title size={28} style={{ textAlign: 'center' }}>
        Vote pour ton préféré
      </Title>
      <Body muted style={{ textAlign: 'center', marginTop: -space.sm }}>
        Tu peux changer d'avis tant que le temps n'est pas écoulé.
      </Body>
      <View style={styles.grid}>
        {view.submissions.map((sub) => (
          <VoteCard
            key={sub.id}
            client={client}
            sub={sub}
            width={colWidth}
            selected={view.myVote === sub.id}
            mine={sub.playerId === me}
            onPress={() => client.send({ t: 'vote', submissionId: sub.id })}
          />
        ))}
      </View>
    </>
  );
}

// ------------------------------------------------------------------ récap de manche

export function RoundResults({ client, view, width }: { client: GameClient; view: GameView; width: number }) {
  const voting = view.settings.votingEnabled;
  const subs = voting ? [...view.submissions].sort((a, b) => b.votes - a.votes) : view.submissions;
  const isLast = view.round >= view.settings.rounds;
  return (
    <>
      <Title size={30} style={{ textAlign: 'center' }}>
        Récap de la manche {view.round}
      </Title>
      <Body muted style={{ textAlign: 'center', marginTop: -space.sm }}>
        {isLast ? 'Récap final juste après…' : 'Prochaine manche à la fin du compte à rebours'}
      </Body>
      {subs.length === 0 && (
        <Card style={{ alignItems: 'center' }}>
          <Body>Personne n'a rien écrit cette manche…</Body>
        </Card>
      )}
      {voting && <PlayerList client={client} view={view} isHost={false} title="Classement" showScores />}
      {subs.map((sub, i) => (
        <View key={sub.id}>
          {voting && i === 0 && sub.votes > 0 && <Text style={styles.winner}>Meme de la manche</Text>}
          <SaveableMeme client={client} submission={sub} width={width} />
        </View>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ fin de partie

export function Final({
  client,
  view,
  width,
  isHost,
  onLeave,
}: {
  client: GameClient;
  view: GameView;
  width: number;
  isHost: boolean;
  onLeave: () => void;
}) {
  const voting = view.settings.votingEnabled;
  const ranking = [...view.players].sort((a, b) => b.score - a.score);
  return (
    <>
      <Title size={44} style={{ textAlign: 'center', color: colors.accent }}>
        Fin de partie !
      </Title>
      {voting && (
        <Card>
          <Label>Classement</Label>
          {ranking.map((p, i) => (
            <View key={p.id} style={styles.rankRow}>
              <Text style={styles.rankMedal}>{i + 1}</Text>
              <PlayerAvatar client={client} player={p} size={34} />
              <Text style={styles.rankName} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.rankScore}>
                {p.score} pt{p.score > 1 ? 's' : ''}
              </Text>
            </View>
          ))}
        </Card>
      )}
      <Body muted style={{ textAlign: 'center' }}>
        Appuie sur « Garder » pour sauvegarder un meme dans tes favoris et ta galerie.
      </Body>
      {view.history.map((r) => (
        <View key={r.round} style={{ gap: space.md }}>
          <Title size={26}>Manche {r.round}</Title>
          {r.submissions.length === 0 && <Body muted>Aucun meme cette manche.</Body>}
          {r.submissions.map((sub) => (
            <SaveableMeme key={sub.id} client={client} submission={sub} width={width} />
          ))}
        </View>
      ))}
      <View style={{ gap: space.sm, marginTop: space.md }}>
        {isHost ? (
          <Button title="Rejouer avec les mêmes potes" onPress={() => client.send({ t: 'backToLobby' })} />
        ) : (
          <Body muted style={{ textAlign: 'center' }}>
            L'hôte peut relancer une partie.
          </Body>
        )}
        <Button title="Quitter" variant="ghost" onPress={onLeave} />
      </View>
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    memeShadow: { alignSelf: 'center', borderRadius: radius.md, overflow: 'hidden', borderWidth: 3, borderColor: colors.accent },
    author: { color: colors.text, fontFamily: fonts.display, fontSize: 26, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
    voteCard: {
      borderRadius: radius.sm,
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: 'transparent',
      backgroundColor: colors.surface,
    },
    voteSelected: { borderColor: colors.accent },
    voteLabel: { color: colors.text, textAlign: 'center', fontFamily: fonts.heavy, paddingVertical: space.sm },
    winner: { color: colors.accent, fontFamily: fonts.display, fontSize: 22, marginBottom: space.xs },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
    rankMedal: { fontSize: 20, width: 28, fontFamily: fonts.display, color: colors.accent },
    rankName: { color: colors.text, fontSize: 17, fontFamily: fonts.bold, flex: 1 },
    rankScore: { color: colors.accent, fontFamily: fonts.display, fontSize: 16 },
  }),
);
