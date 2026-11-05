import { Anton_400Regular, useFonts } from '@expo-google-fonts/anton';
// Import par graisse : seules les polices utilisées sont embarquées.
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold';
import { Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat/800ExtraBold';
import { Montserrat_900Black } from '@expo-google-fonts/montserrat/900Black';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors, setTheme, useThemeId } from '../components/theme';
import { getProfile } from '../storage/profile';

// Thème choisi par l'utilisateur, appliqué avant le premier affichage.
setTheme(getProfile().themeId);

export default function RootLayout() {
  const [loaded] = useFonts({
    Anton_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    Montserrat_900Black,
  });
  useThemeId(); // re-rendu (fond de navigation) quand le thème change
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="game" options={{ gestureEnabled: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
