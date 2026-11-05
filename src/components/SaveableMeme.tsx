import { useRef, useState } from 'react';
import { Alert, type HostInstance, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { GameClient } from '../net/GameClient';
import { Submission } from '../shared/types';
import { addFavorite, saveToGallery } from '../storage/favorites';
import { MemeView, useTemplateImage } from './MemeView';
import { colors, radius, space, themed } from './theme';
import { Button } from './ui';

export function SaveableMeme({
  client,
  submission,
  width,
  showAuthor = true,
}: {
  client: GameClient;
  submission: Submission;
  width: number;
  showAuthor?: boolean;
}) {
  const ref = useRef<HostInstance>(null);
  const image = useTemplateImage(client, submission.template);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      addFavorite(uri, { author: submission.playerName, templateName: submission.template.name });
      const inGallery = await saveToGallery(uri).catch(() => false);
      setSaved(true);
      if (!inGallery)
        Alert.alert('Sauvegardé dans tes favoris', "Autorise l'accès aux photos pour l'avoir aussi dans ta galerie.");
    } catch (e: any) {
      Alert.alert('Oups', `Impossible de sauvegarder ce meme (${e?.message ?? e}).`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { width }]}>
      <MemeView ref={ref} template={submission.template} captions={submission.captions} width={width} imageUri={image} />
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          {showAuthor && (
            <Text style={styles.author} numberOfLines={1}>
              {submission.playerName}
            </Text>
          )}
          {submission.votes > 0 && (
            <Text style={styles.votes}>
              {'🔥'.repeat(Math.min(submission.votes, 5))} {submission.votes} vote{submission.votes > 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <Button
          small
          title={saved ? 'Sauvegardé' : 'Garder'}
          icon={saved ? '✅' : '💾'}
          variant={saved ? 'ghost' : 'secondary'}
          disabled={saved || image === undefined}
          loading={busy}
          onPress={save}
        />
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
    footer: { flexDirection: 'row', alignItems: 'center', padding: space.sm + 4, gap: space.sm },
    author: { color: colors.text, fontWeight: '800', fontSize: 16 },
    votes: { color: colors.accent, fontWeight: '700', marginTop: 2 },
  }),
);
