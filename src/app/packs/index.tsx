import { router } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, space, themed } from '../../components/theme';
import { Body, Button, Card, Label, Screen, Title } from '../../components/ui';
import { createPack, getAllPacks, packsSignal } from '../../storage/packs';

export default function Packs() {
  useSyncExternalStore(packsSignal.subscribe, packsSignal.getVersion);
  const packs = getAllPacks();
  const [name, setName] = useState('');

  const create = () => {
    const pack = createPack(name);
    setName('');
    router.push({ pathname: '/packs/[id]', params: { id: pack.id } });
  };

  return (
    <Screen scroll>
      <Title>Mes packs</Title>
      <Body muted>
        Ajoute tes propres images (la tête de ton pote, une capture culte…). Quand tu héberges une partie, tu choisis quels packs
        utiliser : les images sont envoyées automatiquement aux autres joueurs.
      </Body>

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
          <Text style={styles.packIcon}>{p.builtin ? '📦' : '🖼️'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.packName} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.packMeta}>
              {p.templates.length} meme{p.templates.length > 1 ? 's' : ''}
              {p.builtin ? ' · intégré' : ''}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

      <Button title="Retour" variant="ghost" onPress={() => router.back()} />
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
    },
    pack: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: space.md,
    },
    packIcon: { fontSize: 30 },
    packName: { color: colors.text, fontSize: 18, fontWeight: '800' },
    packMeta: { color: colors.muted, marginTop: 2 },
    chevron: { color: colors.muted, fontSize: 30 },
  }),
);
