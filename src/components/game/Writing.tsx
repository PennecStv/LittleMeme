import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { GameClient } from '../../net/GameClient';
import { GameView } from '../../shared/types';
import { MemeView, useTemplateImage } from '../MemeView';
import { colors, radius, space, themed } from '../theme';
import { Body, Button, Label } from '../ui';

const zoneLabel = (count: number, i: number) => {
  if (count === 1) return 'Ton texte';
  if (count === 2) return i === 0 ? 'Texte 1 (haut / gauche)' : 'Texte 2 (bas / droite)';
  return `Texte ${i + 1}`;
};

/** À monter avec une `key` liée à la manche et au template : un nouveau meme repart de zéro. */
export function Writing({ client, view, width }: { client: GameClient; view: GameView; width: number }) {
  const me = view.me!;
  const image = useTemplateImage(client, me.template);
  const [captions, setCaptions] = useState<string[]>(me.captions);
  const [focused, setFocused] = useState<number | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (sendTimer.current) clearTimeout(sendTimer.current);
    },
    [],
  );

  const update = (i: number, text: string) => {
    const next = captions.map((c, j) => (j === i ? text : c));
    setCaptions(next);
    // On envoie le brouillon à l'hôte régulièrement : si le temps s'écoule, c'est lui qui est utilisé.
    if (sendTimer.current) clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(() => client.send({ t: 'captions', captions: next }), 250);
  };

  const toggleReady = () => {
    if (sendTimer.current) clearTimeout(sendTimer.current);
    client.send({ t: 'captions', captions });
    client.send({ t: 'ready', ready: !me.ready });
  };

  const readyCount = view.players.filter((p) => p.connected && p.ready).length;
  const activeCount = view.players.filter((p) => p.connected).length;
  const empty = captions.every((c) => !c.trim());

  return (
    <>
      <View style={styles.memeWrap}>
        <MemeView
          template={me.template}
          captions={captions}
          width={width}
          imageUri={image}
          placeholders
          highlightZone={focused}
        />
      </View>
      <Text style={styles.templateName}>« {me.template.name} »</Text>

      {me.template.zones.map((_, i) => (
        <View key={i} style={{ gap: space.xs }}>
          <Label>{zoneLabel(me.template.zones.length, i)}</Label>
          <TextInput
            value={captions[i] ?? ''}
            onChangeText={(t) => update(i, t)}
            onFocus={() => setFocused(i)}
            onBlur={() => setFocused(null)}
            editable={!me.ready}
            placeholder="Écris un truc drôle…"
            placeholderTextColor={colors.muted}
            style={[styles.input, me.ready && { opacity: 0.5 }]}
            multiline
            maxLength={140}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
          />
        </View>
      ))}

      <View style={styles.actions}>
        {me.rerollsLeft > 0 && !me.ready && (
          <Button
            variant="secondary"
            title={`Autre meme (${me.rerollsLeft})`}
            icon="🎲"
            onPress={() => client.send({ t: 'reroll' })}
            style={{ flex: 1 }}
          />
        )}
        <Button
          title={me.ready ? 'Modifier' : 'Valider'}
          icon={me.ready ? '✏️' : '✅'}
          variant={me.ready ? 'ghost' : 'primary'}
          onPress={toggleReady}
          disabled={!me.ready && empty}
          style={{ flex: 1 }}
        />
      </View>
      <Body muted style={{ textAlign: 'center' }}>
        {readyCount}/{activeCount} joueur{activeCount > 1 ? 's ont' : ' a'} validé
      </Body>
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    memeWrap: { alignItems: 'center', borderRadius: radius.md, overflow: 'hidden', alignSelf: 'center' },
    templateName: { color: colors.muted, textAlign: 'center', fontStyle: 'italic', marginTop: -space.sm },
    input: {
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: space.md,
      paddingVertical: space.sm + 4,
      fontSize: 17,
      minHeight: 50,
    },
    actions: { flexDirection: 'row', gap: space.sm },
  }),
);
