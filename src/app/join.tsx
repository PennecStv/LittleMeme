import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { QR_PREFIX } from '../components/game/Lobby';
import { colors, fonts, radius, space, themed } from '../components/theme';
import { Body, Button, Label, Screen, Title } from '../components/ui';
import { joinGame } from '../session/session';

export default function Join() {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  const join = async (value: string) => {
    if (!value.trim()) return;
    setJoining(true);
    try {
      await joinGame(value);
      router.replace('/game');
    } catch (e: any) {
      Alert.alert('Oups', e?.message ?? String(e));
    } finally {
      setJoining(false);
    }
  };

  const startScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return Alert.alert('Caméra', 'Autorise la caméra pour scanner le QR code, ou tape le code à la main.');
    }
    scanned.current = false;
    setScanning(true);
  };

  return (
    <Screen scroll>
      <Title>Rejoindre</Title>
      <Body muted>Demande le code à l'hôte. Vous devez être connectés au même Wifi (ou au partage de connexion de l'hôte).</Body>

      <View style={{ gap: space.xs }}>
        <Label>Code de la salle</Label>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="EX : 22BC"
          placeholderTextColor={colors.border}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={15}
          style={styles.code}
          onSubmitEditing={() => join(code)}
          returnKeyType="go"
        />
      </View>
      <Button title="Rejoindre" icon="🚪" onPress={() => join(code)} loading={joining} disabled={!code.trim()} />

      {scanning ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (scanned.current || !data?.startsWith(QR_PREFIX)) return;
              scanned.current = true;
              setScanning(false);
              join(data.slice(QR_PREFIX.length));
            }}
          />
        </View>
      ) : null}
      <Button
        title={scanning ? 'Annuler le scan' : 'Scanner le QR code'}
        icon="📷"
        variant="secondary"
        onPress={scanning ? () => setScanning(false) : startScan}
      />
      <Button title="Retour" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    code: {
      backgroundColor: colors.surface,
      color: colors.accent,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.border,
      height: 90,
      textAlign: 'center',
      fontFamily: fonts.display,
      fontSize: 48,
      letterSpacing: 6,
    },
    cameraWrap: { height: 300, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  }),
);
