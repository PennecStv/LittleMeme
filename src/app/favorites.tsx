import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSyncExternalStore } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, fonts, radius, space, themed } from '../components/theme';
import { Body, Button, Card, Screen, Title } from '../components/ui';
import { deleteFavorite, Favorite, favoriteFile, favoritesSignal, getFavorites, saveToGallery } from '../storage/favorites';

export default function Favorites() {
  useSyncExternalStore(favoritesSignal.subscribe, favoritesSignal.getVersion);
  const favorites = getFavorites();
  const { width } = useWindowDimensions();
  const size = Math.floor((width - space.md * 2 - space.sm) / 2);

  const open = (fav: Favorite) => {
    const uri = favoriteFile(fav.id).uri;
    Alert.alert(fav.templateName, `par ${fav.author}`, [
      {
        text: 'Partager',
        onPress: async () => {
          if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        },
      },
      {
        text: 'Mettre dans la galerie',
        onPress: async () => {
          const ok = await saveToGallery(uri).catch(() => false);
          Alert.alert(ok ? 'Ajouté à ta galerie 📸' : 'Accès aux photos refusé');
        },
      },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteFavorite(fav.id) },
      { text: 'Fermer', style: 'cancel' },
    ]);
  };

  return (
    <Screen scroll>
      <Title>Mes favoris</Title>
      {favorites.length === 0 && (
        <Card style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 40 }}>💾</Text>
          <Body muted style={{ textAlign: 'center' }}>
            Pas encore de favoris. Dans le récap d'une manche ou en fin de partie, appuie sur « Garder » sous un meme.
          </Body>
        </Card>
      )}
      <View style={styles.grid}>
        {favorites.map((f) => (
          <Pressable key={f.id} onPress={() => open(f)} style={[styles.item, { width: size }]}>
            <Image source={{ uri: favoriteFile(f.id).uri }} style={{ width: size, height: size }} resizeMode="contain" />
            <Text style={styles.author} numberOfLines={1}>
              {f.author}
            </Text>
          </Pressable>
        ))}
      </View>
      <Button title="Retour" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    item: { backgroundColor: colors.surface, borderRadius: radius.sm, overflow: 'hidden' },
    author: { color: colors.text, padding: space.sm, fontFamily: fonts.bold },
  }),
);
