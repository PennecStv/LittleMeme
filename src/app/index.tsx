import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { StippleShade, StippleTitle } from '../components/Stipple';
import { colors, fonts, radius, setTheme, space, themed, THEMES, ThemeId, useThemeId } from '../components/theme';
import { Button, Label, Screen } from '../components/ui';
import { useLoop } from '../components/useLoop';
import { useHomeText } from '../data/homeTexts';
import { hostGame } from '../session/session';
import { avatarUri, clearAvatar, getProfile, setAvatar, updateProfile, useProfile } from '../storage/profile';

const SPLASH_YELLOW = '#ffe14d';

function Logo({ splash }: { splash: string }) {
  const { width } = useWindowDimensions();
  const bounce = useLoop(420);
  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  return (
    <View style={styles.hero}>
      <Text style={styles.logoTop}>LITTLE</Text>
      <StippleTitle text="MEME" fontSize={96} width={Math.min(width - space.md * 2, 480)} />
      {/* Phrase surprise façon Minecraft, en sticker ombré en points qui sautille */}
      <Animated.View style={[styles.splash, { transform: [{ rotate: '-6deg' }, { translateY }] }]}>
        <StippleShade color="#7a5a00" opacity={0.35} reach={0.8} />
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.splashText}>
          {splash}
        </Text>
      </Animated.View>
    </View>
  );
}

function ThemePicker() {
  const current = useThemeId();
  const choose = (id: ThemeId) => {
    setTheme(id);
    updateProfile({ themeId: id });
  };
  return (
    <View style={{ gap: space.xs }}>
      <Label>Thème</Label>
      <View style={styles.themes}>
        {(Object.keys(THEMES) as ThemeId[]).map((id) => {
          const t = THEMES[id];
          const active = id === current;
          return (
            <Pressable key={id} onPress={() => choose(id)} style={[styles.theme, active && styles.themeActive]}>
              <View style={styles.swatches}>
                {[t.palette.bg, t.palette.accent, t.palette.accent2].map((c, i) => (
                  <View key={i} style={[styles.swatch, { backgroundColor: c, marginLeft: i ? -6 : 0 }]} />
                ))}
              </View>
              <Text style={[styles.themeName, active && { color: colors.accent }]} numberOfLines={1}>
                {t.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function Home() {
  useThemeId(); // re-rendu quand le thème change
  const profile = useProfile();
  const { tagline, splash } = useHomeText();
  const [name, setName] = useState(() => getProfile().name);
  const [hosting, setHosting] = useState(false);

  const changeName = (n: string) => {
    setName(n);
    updateProfile({ name: n.trim() });
  };

  const needName = () => {
    if (name.trim()) return false;
    Alert.alert('Ton pseudo', "Choisis d'abord un pseudo pour que tes potes te reconnaissent.");
    return true;
  };

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      await setAvatar(res.assets[0].uri);
    } catch (e: any) {
      Alert.alert('Oups', `Impossible d'utiliser cette image (${e?.message ?? e}).`);
    }
  };

  const editAvatar = () => {
    if (!profile.avatarFile) return pickAvatar();
    Alert.alert('Photo de profil', undefined, [
      { text: 'Changer la photo', onPress: pickAvatar },
      { text: 'Supprimer la photo', style: 'destructive', onPress: clearAvatar },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const create = async () => {
    if (needName()) return;
    setHosting(true);
    try {
      await hostGame();
      router.push('/game');
    } catch (e: any) {
      Alert.alert('Impossible de créer la partie', e?.message ?? String(e));
    } finally {
      setHosting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen scroll animated style={styles.content}>
        <Logo splash={splash} />
        <Text style={styles.tagline}>{tagline}</Text>

        <View style={styles.profile}>
          <Pressable onPress={editAvatar} accessibilityLabel="Modifier la photo de profil">
            <Avatar uri={avatarUri(profile)} name={name || '?'} size={64} ring />
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>✎</Text>
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: space.xs }}>
            <Label>Ton pseudo</Label>
            <TextInput
              value={name}
              onChangeText={changeName}
              placeholder="Ex : Steve"
              placeholderTextColor={colors.muted}
              maxLength={20}
              style={styles.input}
              autoCorrect={false}
            />
          </View>
        </View>

        <Button title="Créer une partie" onPress={create} loading={hosting} />
        <Button title="Rejoindre une partie" variant="secondary" onPress={() => !needName() && router.push('/join')} />
        <View style={styles.row}>
          <Button title="Mes packs" variant="ghost" onPress={() => router.push('/packs')} style={{ flex: 1 }} />
          <Button title="Favoris" variant="ghost" onPress={() => router.push('/favorites')} style={{ flex: 1 }} />
        </View>

        <ThemePicker />
      </Screen>
      <View style={styles.topBand} />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    content: { flexGrow: 1, justifyContent: 'center', gap: space.md, paddingVertical: space.xl },
    topBand: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: colors.accent },
    hero: { alignItems: 'center', marginBottom: space.xl },
    logoTop: { fontFamily: fonts.heavy, fontSize: 18, color: colors.muted, letterSpacing: 14, marginRight: -14 },
    splash: {
      position: 'absolute',
      right: 0,
      bottom: -40,
      maxWidth: '80%',
      backgroundColor: SPLASH_YELLOW,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 6,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: '#1a1400',
    },
    splashText: { color: '#1a1400', fontSize: 14, fontFamily: fonts.display },
    tagline: { color: colors.accent2, fontSize: 17, fontFamily: fonts.heavy, textAlign: 'center', marginBottom: space.sm },
    profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    editBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.accent2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bg,
    },
    editBadgeText: { color: colors.bg, fontSize: 13, fontFamily: fonts.display },
    input: {
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: space.md,
      height: 50,
      fontSize: 17,
      fontFamily: fonts.bold,
    },
    row: { flexDirection: 'row', gap: space.sm },
    themes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    theme: {
      flexBasis: '45%',
      flexGrow: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: space.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    themeActive: { borderColor: colors.accent },
    swatches: { flexDirection: 'row' },
    swatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.surface },
    themeName: { color: colors.text, fontFamily: fonts.heavy, fontSize: 13 },
  }),
);
