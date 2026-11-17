import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lobby } from '../components/game/Lobby';
import { Final, Reveal, RoundResults, Voting } from '../components/game/Phases';
import { PlayerList } from '../components/game/PlayerList';
import { Writing } from '../components/game/Writing';
import { colors, fonts, space, themed } from '../components/theme';
import { Body, Button, Countdown } from '../components/ui';
import { GameClient } from '../net/GameClient';
import { leaveGame, useGameSnapshot, useSession } from '../session/session';
import { Phase } from '../shared/types';

const PHASE_TITLES: Record<Phase, string> = {
  lobby: 'Salle d’attente',
  writing: 'À toi de jouer !',
  reveal: 'Présentation',
  voting: 'Votes',
  roundResults: 'Récap',
  final: 'Fin de partie',
};

export default function GameScreen() {
  const session = useSession();
  if (!session) return <Redirect href="/" />;
  return <Game client={session.client} roomCode={session.roomCode} ip={session.ip} />;
}

function Game({ client, roomCode, ip }: { client: GameClient; roomCode: string | null; ip: string | null }) {
  useKeepAwake();
  const snap = useGameSnapshot(client);
  const { width: screenWidth } = useWindowDimensions();
  const memeWidth = Math.min(screenWidth - space.md * 2, 520);
  const view = snap.view;

  const leave = () => {
    router.replace('/');
    leaveGame();
  };

  const confirmLeave = () => {
    if (snap.status === 'closed') return leave();
    Alert.alert('Quitter la partie ?', snap.isHost ? 'Tu es l’hôte : la partie s’arrêtera pour tout le monde.' : undefined, [
      { text: 'Rester', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: leave },
    ]);
  };

  // Bouton retour Android : on demande confirmation au lieu de quitter la partie.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmLeave();
      return true;
    });
    return () => sub.remove();
  });

  // Erreur non bloquante envoyée par l'hôte (ex. aucun pack actif).
  useEffect(() => {
    if (snap.error && snap.status !== 'closed') Alert.alert('Oups', snap.error);
  }, [snap.error, snap.status]);

  if (snap.status === 'closed') {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={{ fontSize: 56 }}>👋</Text>
        <Body style={{ textAlign: 'center' }}>{snap.error ?? 'La partie est terminée.'}</Body>
        <Button title="Retour à l'accueil" onPress={leave} style={{ alignSelf: 'stretch', margin: space.md }} />
      </SafeAreaView>
    );
  }

  if (!view) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  const isHost = snap.isHost;
  const timed = view.phase !== 'lobby' && view.phase !== 'final';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={confirmLeave} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{PHASE_TITLES[view.phase]}</Text>
          {view.round > 0 && view.phase !== 'lobby' && view.phase !== 'final' && (
            <Text style={styles.headerSub}>
              Manche {view.round}/{view.settings.rounds}
            </Text>
          )}
        </View>
        {isHost && timed && <Button small variant="ghost" title="Passer ⏭" onPress={() => client.send({ t: 'skip' })} />}
      </View>
      {timed && (
        <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm }}>
          <Countdown deadline={snap.deadline} total={view.phaseDurationMs} />
        </View>
      )}
      {snap.status === 'reconnecting' && (
        <View style={styles.banner}>
          <ActivityIndicator color={colors.accentText} size="small" />
          <Text style={styles.bannerText}>Connexion perdue, reconnexion…</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {view.phase === 'lobby' && <Lobby client={client} view={view} isHost={isHost} roomCode={roomCode} ip={ip} />}
          {view.phase === 'writing' &&
            (view.me ? (
              <Writing key={`${view.round}-${view.me.template.id}`} client={client} view={view} width={memeWidth} />
            ) : (
              <>
                <Body style={{ textAlign: 'center' }}>Tu as rejoint en cours de manche : tu joues à la prochaine 😉</Body>
                <PlayerList client={client} view={view} isHost={false} title="Qui a fini ?" showReady />
              </>
            ))}
          {view.phase === 'reveal' && <Reveal client={client} view={view} width={memeWidth} />}
          {view.phase === 'voting' && <Voting client={client} view={view} width={memeWidth} />}
          {view.phase === 'roundResults' && <RoundResults client={client} view={view} width={memeWidth} />}
          {view.phase === 'final' && <Final client={client} view={view} width={memeWidth} isHost={isHost} onLeave={leave} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm },
    close: { color: colors.muted, fontSize: 24, fontFamily: fonts.bold, paddingHorizontal: 4 },
    headerTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 26 },
    headerSub: { color: colors.muted, fontFamily: fonts.bold },
    banner: {
      flexDirection: 'row',
      gap: space.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      padding: space.sm,
    },
    bannerText: { color: colors.accentText, fontFamily: fonts.heavy },
    content: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  }),
);
