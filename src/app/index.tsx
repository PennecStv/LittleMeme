import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Avatar } from '../components/Avatar';
import { colors, fonts, radius, setTheme, space, themed, THEMES, ThemeId, useThemeId } from '../components/theme';
import { Button, Label, Screen } from '../components/ui';
import { useHomeText } from '../data/homeTexts';
import { hostGame } from '../session/session';
import { avatarUri, clearAvatar, getProfile, setAvatar, updateProfile, useProfile } from '../storage/profile';

/** Boucle d'animation 0 → 1 → 0. */
function useLoop(duration: number, delay = 0) {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    // Pas d'animation si l'utilisateur a activé « Réduire les animations ».
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => !reduce && anim.start());
    return () => anim.stop();
  }, [value, duration, delay]);
  return value;
}

/** Grandes taches de couleur du thème qui dérivent lentement derrière l'accueil. */
function Blob({
  color,
  size,
  x,
  y,
  duration,
  drift,
}: {
  color: string;
  size: number;
  x: number;
  y: number;
  duration: number;
  drift: number;
}) {
  const t = useLoop(duration);
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -drift * 0.7] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  return (
    <Animated.View
      style={[
        styles.blob,
        { backgroundColor: color, width: size, height: size, left: x - size / 2, top: y - size / 2 },
        { transform: [{ translateX }, { translateY }, { scale }] },
      ]}
    />
  );
}

function AnimatedBackground() {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Blob color={colors.accent} size={width * 0.95} x={width * 0.95} y={height * 0.1} duration={9000} drift={-width * 0.25} />
      <Blob color={colors.accent2} size={width * 0.7} x={0} y={height * 0.55} duration={11000} drift={width * 0.3} />
      <Blob color={colors.accent} size={width * 0.8} x={width * 0.7} y={height * 1.02} duration={13000} drift={-width * 0.2} />
    </View>
  );
}

function Logo({ splash }: { splash: string }) {
  const pulse = useLoop(450);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  return (
    <View style={styles.hero}>
      <Text style={styles.logoTop}>LITTLE</Text>
      <Text style={styles.logoBottom}>MEME</Text>
      <View style={styles.logoBar} />
      {/* Phrase surprise façon Minecraft */}
      <Animated.Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.splash, { transform: [{ rotate: '-6deg' }, { scale }] }]}
      >
        {splash}
      </Animated.Text>
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AnimatedBackground />
      <View style={styles.topBand} />
      <Screen scroll transparent style={styles.content}>
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
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    content: { flexGrow: 1, justifyContent: 'center', gap: space.md, paddingVertical: space.xl },
    blob: { position: 'absolute', borderRadius: 9999, opacity: 0.12 },
    topBand: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: colors.accent },
    hero: { alignItems: 'center', marginBottom: space.xl },
    logoTop: { fontFamily: fonts.heavy, fontSize: 18, color: colors.muted, letterSpacing: 14, marginRight: -14 },
    logoBottom: {
      fontFamily: fonts.display,
      fontSize: 92,
      color: colors.text,
      lineHeight: 104,
      letterSpacing: -3,
      marginTop: -6,
    },
    logoBar: { width: 72, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 2 },
    splash: {
      position: 'absolute',
      right: 0,
      bottom: -34,
      maxWidth: '78%',
      textAlign: 'center',
      color: '#ffef3a',
      fontSize: 15,
      fontFamily: fonts.display,
      textShadowColor: '#3f3f00',
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 0,
    },
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
