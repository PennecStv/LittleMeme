import { router } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, space, themed } from '../../components/theme';
import { Body, Button, Card, Label, Screen, Title } from '../../components/ui';
import { createPack, getAllPacks, importMemegenPack, MEMEGEN_PACK_NAME, packsSignal } from '../../storage/packs';

export default function Packs() {
  useSyncExternalStore(packsSignal.subscribe, packsSignal.getVersion);
  const packs = getAllPacks();
  const [name, setName] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const hasMemegen = packs.some((p) => p.name === MEMEGEN_PACK_NAME);

  const importPopular = async () => {
    setProgress('Connexion…');
    try {
      const { added, failed } = await importMemegenPack((done, total) => setProgress(`${done}/${total}`));
      Alert.alert(
        'Import terminé',
        `${added} memes ajoutés au pack « ${MEMEGEN_PACK_NAME} ».` +
          (failed
            ? `
${failed} n'ont pas pu être téléchargés : relance l'import pour les récupérer.`
            : ''),
      );
    } catch (e: any) {
      Alert.alert(
        'Import impossible',
        `${e?.message ?? e}
Vérifie ta connexion Internet.`,
      );
    } finally {
      setProgress(null);
    }
  };

  const create = () => {
    const pack = createPack(name);
    setName('');
    router.push({ pathname: '/packs/[id]', params: { id: pack.id } });
  };

  return (
    <Screen scroll>
      <Button small variant="ghost" title="Retour" onPress={() => router.back()} style={{ alignSelf: 'flex-start' }} />
      <Title>Mes packs</Title>
      <Body muted>
        Ajoute tes propres images (la tête de ton pote, une capture culte…). Quand tu héberges une partie, tu choisis quels packs
        utiliser : les images sont envoyées automatiquement aux autres joueurs.
      </Body>

      <Card>
        <Label>Memes populaires</Label>
        <Body muted>
          Environ 200 templates connus (Drake, Distracted Boyfriend…) téléchargés depuis memegen.link. Internet est nécessaire une
          seule fois, ensuite ils marchent en Wifi local comme tes packs.
        </Body>
        <Button
          title={
            progress ? `Import en cours… ${progress}` : hasMemegen ? 'Compléter / mettre à jour' : 'Importer les memes populaires'
          }
          variant={hasMemegen ? 'secondary' : 'primary'}
          onPress={importPopular}
          disabled={!!progress}
        />
      </Card>

      <Card>
        <Label>Nouveau pack</Label>
        <View style={styles.row}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex : Les dossiers du groupe"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={40}
            onSubmitEditing={create}
          />
          <Button small title="Créer" onPress={create} />
        </View>
      </Card>

      {packs.map((p) => (
        <Pressable key={p.id} onPress={() => router.push({ pathname: '/packs/[id]', params: { id: p.id } })} style={styles.pack}>
          <View style={{ flex: 1 }}>
            <Text style={styles.packName} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.packMeta}>
              {p.templates.length} meme{p.templates.length > 1 ? 's' : ''}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

    </Screen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
    input: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      borderRadius: radius.sm,
      paddingHorizontal: space.md,
      height: 44,
      fontSize: 16,
      fontFamily: fonts.semibold,
    },
    pack: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: space.md,
    },
    packName: { color: colors.text, fontSize: 18, fontFamily: fonts.heavy },
    packMeta: { color: colors.muted, marginTop: 2 },
    chevron: { color: colors.muted, fontSize: 30 },
  }),
);
